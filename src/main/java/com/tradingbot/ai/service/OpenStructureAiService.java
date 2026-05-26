package com.tradingbot.ai.service;

import com.tradingbot.ai.dto.AiDtos.*;
import com.tradingbot.ai.prompt.AiPromptBuilderService;
import com.tradingbot.ai.provider.AbstractGenerateAiProvider;
import com.tradingbot.ai.provider.AiProviderFactory;
import com.tradingbot.ai.provider.NoOpAiProvider;
import com.tradingbot.api.DashboardService;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.OpeningMomentumDto;
import com.tradingbot.config.AiProperties;
import com.tradingbot.intelligence.BehaviorAnalyticsService;
import com.tradingbot.intelligence.TraderPerformanceAnalyticsService;
import com.tradingbot.services.MarketTrendService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class OpenStructureAiService {

    private final AiProviderFactory providerFactory;
    private final AiPromptBuilderService promptBuilder;
    private final AiResponseValidator validator;
    private final DashboardService dashboardService;
    private final MarketTrendService marketTrendService;
    private final NoOpAiProvider noOp;
    private final AiProperties properties;

    private final ConcurrentHashMap<String, CachedOpen> cache = new ConcurrentHashMap<>();

    public OpenStructureResponseDto analyze(String symbol) {
        String sym = symbol == null ? "" : symbol.toUpperCase(Locale.ROOT);
        CachedOpen hit = cache.get(sym);
        if (hit != null && System.currentTimeMillis() - hit.ts < properties.getCacheTtlMs()) {
            return hit.response;
        }

        OpenStructureRequestDto request = buildRequest(sym);
        String prompt = promptBuilder.buildOpenStructurePrompt(request);
        AbstractGenerateAiProvider provider = providerFactory.resolve();

        OpenStructureResponseDto raw = provider instanceof NoOpAiProvider
                ? noOp.analyzeOpenStructureDeterministic(request)
                : provider.analyzeOpenStructureWithPrompt(prompt);

        if (!raw.isAvailable()) {
            raw = noOp.analyzeOpenStructureDeterministic(request);
        }

        OpenStructureResponseDto validated = validator.validateOpenStructure(raw);
        cache.put(sym, new CachedOpen(validated, System.currentTimeMillis()));
        return validated;
    }

    private OpenStructureRequestDto buildRequest(String sym) {
        MarketTrendDto trend = marketTrendService.getMarketTrend();
        List<OpeningMomentumDto> opening = dashboardService.getOpeningMomentum();
        double avgGap = opening.stream().map(OpeningMomentumDto::getGapPercent).filter(g -> g != null)
                .mapToDouble(Double::doubleValue).average().orElse(0);
        double avgRvol = opening.stream().map(OpeningMomentumDto::getRelativeVolume).filter(r -> r != null)
                .mapToDouble(Double::doubleValue).average().orElse(0);
        String topType = opening.isEmpty() ? "—" : opening.get(0).getSignalType();

        return OpenStructureRequestDto.builder()
                .symbol(sym)
                .marketRegime(trend != null ? trend.getRegime() : "UNKNOWN")
                .marketBreadth(buildBreadth(trend))
                .openCandidateCount(opening.size())
                .topOpenType(topType)
                .avgGapPercent(avgGap)
                .avgRvol(avgRvol)
                .build();
    }

    private String buildBreadth(MarketTrendDto trend) {
        if (trend == null) return "—";
        return String.join(" · ", List.of(
                trend.getSemiBreadth() != null ? trend.getSemiBreadth() : "",
                trend.getAiBreadth() != null ? trend.getAiBreadth() : ""
        ).stream().filter(s -> !s.isBlank()).toList());
    }

    private record CachedOpen(OpenStructureResponseDto response, long ts) {}
}
