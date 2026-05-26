package com.tradingbot.ai.service;

import com.tradingbot.ai.dto.AiDtos.*;
import com.tradingbot.ai.prompt.AiPromptBuilderService;
import com.tradingbot.ai.provider.AbstractGenerateAiProvider;
import com.tradingbot.ai.provider.AiProviderFactory;
import com.tradingbot.ai.provider.NoOpAiProvider;
import com.tradingbot.api.dto.BehaviorInsightDto;
import com.tradingbot.api.dto.TraderEdgeDto;
import com.tradingbot.api.dto.cognition.CognitionSnapshotDto;
import com.tradingbot.config.AiProperties;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.intelligence.BehaviorAnalyticsService;
import com.tradingbot.intelligence.TraderPerformanceAnalyticsService;
import com.tradingbot.intelligence.cognition.TraderCognitionOrchestrator;
import com.tradingbot.services.MarketTrendService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class AiCoachingIntelligenceService {

    private final AiProviderFactory providerFactory;
    private final AiPromptBuilderService promptBuilder;
    private final AiResponseValidator validator;
    private final TraderCognitionOrchestrator cognitionOrchestrator;
    private final BehaviorAnalyticsService behaviorAnalyticsService;
    private final TraderPerformanceAnalyticsService performanceAnalyticsService;
    private final MarketTrendService marketTrendService;
    private final TradingProperties tradingProperties;
    private final NoOpAiProvider noOp;
    private final AiProperties properties;

    private final ConcurrentHashMap<String, CachedCoaching> cache = new ConcurrentHashMap<>();

    public CoachingResponseDto generate(String symbol) {
        String sym = symbol == null ? "" : symbol.toUpperCase(Locale.ROOT);
        CachedCoaching hit = cache.get(sym);
        if (hit != null && System.currentTimeMillis() - hit.ts < properties.getCacheTtlMs() * 2) {
            return hit.response;
        }

        CoachingRequestDto request = buildRequest(sym);
        String prompt = promptBuilder.buildCoachingPrompt(request);
        AbstractGenerateAiProvider provider = providerFactory.resolve();

        CoachingResponseDto raw = provider instanceof NoOpAiProvider
                ? noOp.generateCoachingDeterministic(request)
                : provider.generateCoachingWithPrompt(prompt);

        if (!raw.isAvailable()) {
            raw = noOp.generateCoachingDeterministic(request);
        }

        CoachingResponseDto validated = validator.validateCoaching(raw);
        cache.put(sym, new CachedCoaching(validated, System.currentTimeMillis()));
        return validated;
    }

    private CoachingRequestDto buildRequest(String sym) {
        var trend = marketTrendService.getMarketTrend();
        CognitionSnapshotDto cognition = cognitionOrchestrator.snapshot(sym);
        List<String> behavior = behaviorAnalyticsService.todayInsights().stream()
                .map(BehaviorInsightDto::getTitle).limit(5).toList();
        TraderEdgeDto edge = performanceAnalyticsService.computeEdge(tradingProperties.getIntelligenceLookbackDays());
        String edgeSummary = edge != null && edge.getBestSetupTypes() != null && !edge.getBestSetupTypes().isEmpty()
                ? "Best: " + edge.getBestSetupTypes().get(0) : "—";
        String sessionSummary = cognition.getSummary() != null
                ? cognition.getSummary().getWhatMattersMost() : "—";

        return CoachingRequestDto.builder()
                .symbol(sym)
                .marketRegime(trend != null ? trend.getRegime() : "UNKNOWN")
                .marketBreadth(trend != null ? trend.getRegime() : "—")
                .behaviorHighlights(behavior)
                .edgeSummary(edgeSummary)
                .sessionSummary(sessionSummary)
                .build();
    }

    private record CachedCoaching(CoachingResponseDto response, long ts) {}
}
