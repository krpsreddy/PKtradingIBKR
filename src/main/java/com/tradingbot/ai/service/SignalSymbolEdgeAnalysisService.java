package com.tradingbot.ai.service;

import com.tradingbot.ai.dto.SymbolEdgeDtos.*;
import com.tradingbot.ai.edge.SymbolEdgeOutcomeAggregator;
import com.tradingbot.ai.prompt.SymbolEdgeAiPromptBuilder;
import com.tradingbot.ai.provider.AbstractGenerateAiProvider;
import com.tradingbot.ai.provider.AiProviderFactory;
import com.tradingbot.ai.provider.NoOpAiProvider;
import com.tradingbot.config.AiProperties;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.models.SignalOutcome;
import com.tradingbot.repository.SignalOutcomeRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Phase 132 — single-symbol edge analysis (analytics only).
 * Aggregates evaluated signals, builds compressed AI payload, returns structured recommendations.
 * Never auto-modifies strategies or trades.
 */
@Service
@RequiredArgsConstructor
public class SignalSymbolEdgeAnalysisService {

    private final SignalOutcomeRepository outcomeRepository;
    private final TradingProperties tradingProperties;
    private final AiProviderFactory providerFactory;
    private final SymbolEdgeAiPromptBuilder promptBuilder;
    private final AiResponseValidator validator;
    private final NoOpAiProvider noOp;
    private final AiProperties aiProperties;

    private final ConcurrentHashMap<String, CachedAnalysis> cache = new ConcurrentHashMap<>();

    /** GET path — aggregate from backend signal outcomes. */
    public SymbolEdgeAnalysisResponseDto analyzeFromBackend(String symbol) {
        String sym = normalize(symbol);
        int lookback = tradingProperties.getIntelligenceLookbackDays();
        LocalDate since = MarketTime.nowLocal().toLocalDate().minusDays(lookback);
        List<SignalOutcome> outcomes = outcomeRepository.findBySymbolAndSessionDateGreaterThanEqualOrderBySessionDateDesc(sym, since);
        SymbolEdgeCompressedDto deterministic = SymbolEdgeOutcomeAggregator.aggregate(sym, lookback, outcomes);
        return compose(sym, lookback, deterministic, "BACKEND_OUTCOMES");
    }

    /** POST path — client provides compressed signal intelligence summary. */
    public SymbolEdgeAnalysisResponseDto analyzeFromClientSummary(SymbolEdgeCompressedDto deterministic) {
        String sym = normalize(deterministic.getSymbol());
        int lookback = deterministic.getLookbackDays() > 0
                ? deterministic.getLookbackDays()
                : tradingProperties.getIntelligenceLookbackDays();
        SymbolEdgeCompressedDto normalized = deterministic.toBuilder()
                .symbol(sym)
                .lookbackDays(lookback)
                .build();
        return compose(sym, lookback, normalized, "SIGNAL_INTELLIGENCE");
    }

    private SymbolEdgeAnalysisResponseDto compose(String sym, int lookback, SymbolEdgeCompressedDto deterministic, String source) {
        String cacheKey = sym + ":" + source + ":" + deterministic.getEvaluatedTrades();
        CachedAnalysis hit = cache.get(cacheKey);
        if (hit != null && System.currentTimeMillis() - hit.ts < aiProperties.getCacheTtlMs() * 3L) {
            return hit.response;
        }

        long start = System.currentTimeMillis();
        List<String> warnings = new ArrayList<>();

        if (deterministic.getEvaluatedTrades() == 0) {
            warnings.add("LOW CONFIDENCE — fewer than 10 evaluated signals.");
            warnings.add("No evaluated WIN/LOSS/NEUTRAL outcomes for this symbol.");
            SymbolEdgeAiAnalysisDto ai = validator.validateSymbolEdge(
                    noOp.analyzeSymbolEdgeDeterministic(deterministic));
            SymbolEdgeAnalysisResponseDto response = SymbolEdgeAnalysisResponseDto.builder()
                    .symbol(sym)
                    .lookbackDays(lookback)
                    .dataSource(source)
                    .aggregateConfidence("LOW")
                    .evaluatedTrades(0)
                    .deterministic(deterministic)
                    .ai(ai)
                    .provider(noOp.id())
                    .latencyMs(System.currentTimeMillis() - start)
                    .fallbackUsed(true)
                    .warnings(warnings)
                    .build();
            cache.put(cacheKey, new CachedAnalysis(response, System.currentTimeMillis()));
            return response;
        }

        if (deterministic.getEvaluatedTrades() < 10) {
            warnings.add("LOW CONFIDENCE — fewer than 10 evaluated signals.");
        } else if (deterministic.getEvaluatedTrades() < 25) {
            warnings.add("MEDIUM CONFIDENCE — sample size below 25.");
        }

        String prompt = promptBuilder.build(deterministic);
        AbstractGenerateAiProvider provider = providerFactory.resolve();
        boolean fallback = provider instanceof NoOpAiProvider;

        SymbolEdgeAiAnalysisDto ai = fallback
                ? noOp.analyzeSymbolEdgeDeterministic(deterministic)
                : provider.analyzeSymbolEdgeWithPrompt(prompt);

        if (!fallback && (ai.getSummary() == null || ai.getSummary().isBlank()
                || ai.getSummary().contains("Provider unavailable"))) {
            ai = noOp.analyzeSymbolEdgeDeterministic(deterministic);
            fallback = true;
            warnings.add("AI provider failed — deterministic fallback used.");
        }

        ai = validator.validateSymbolEdge(ai);

        String aggregateConfidence = SymbolEdgeOutcomeAggregator.aggregateConfidence(deterministic.getEvaluatedTrades());
        if (deterministic.getEvaluatedTrades() < 10) {
            aggregateConfidence = "LOW";
        }

        SymbolEdgeAnalysisResponseDto response = SymbolEdgeAnalysisResponseDto.builder()
                .symbol(sym)
                .lookbackDays(lookback)
                .dataSource(source)
                .aggregateConfidence(aggregateConfidence)
                .evaluatedTrades(deterministic.getEvaluatedTrades())
                .deterministic(deterministic)
                .ai(ai)
                .provider(fallback ? noOp.id() : provider.id())
                .latencyMs(System.currentTimeMillis() - start)
                .fallbackUsed(fallback)
                .warnings(warnings)
                .build();

        cache.put(cacheKey, new CachedAnalysis(response, System.currentTimeMillis()));
        return response;
    }

    private static String normalize(String symbol) {
        return symbol == null ? "" : symbol.trim().toUpperCase(Locale.ROOT);
    }

    private record CachedAnalysis(SymbolEdgeAnalysisResponseDto response, long ts) {}
}
