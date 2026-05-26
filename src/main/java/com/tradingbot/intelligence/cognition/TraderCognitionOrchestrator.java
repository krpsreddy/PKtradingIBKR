package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.cognition.CognitionSnapshotDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.*;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.intelligence.*;
import com.tradingbot.intelligence.dto.SymbolIntelligenceDto;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.repository.TradingSignalRepository;
import com.tradingbot.services.MarketTrendService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TraderCognitionOrchestrator {

    private final SetupNarrativeService setupNarrativeService;
    private final SessionPriorityEngine sessionPriorityEngine;
    private final SessionTemperatureService sessionTemperatureService;
    private final TraderCoachingFeedService coachingFeedService;
    private final MarketPersonalityService marketPersonalityService;
    private final PremarketPreparationService premarketPreparationService;
    private final PersonalizedCoachingService personalizedCoachingService;
    private final TraderDisciplineScoreService disciplineScoreService;
    private final IntelligenceEventStreamService eventStreamService;
    private final MarketMemoryNarrativeService memoryNarrativeService;
    private final ProbabilisticGuidanceService probabilisticGuidanceService;
    private final IntelligenceSummarizationService summarizationService;
    private final AiSessionReviewService aiSessionReviewService;
    private final PerformanceHeatmapService performanceHeatmapService;
    private final VisualEmphasisService visualEmphasisService;

    private final MarketTrendService marketTrendService;
    private final MarketMemoryService marketMemoryService;
    private final BehaviorAnalyticsService behaviorAnalyticsService;
    private final TraderPerformanceAnalyticsService performanceAnalyticsService;
    private final IntelligenceEnrichmentService enrichmentService;
    private final TradingSignalRepository signalRepository;
    private final TradingProperties tradingProperties;

    public CognitionSnapshotDto snapshot(String symbol) {
        int lookback = tradingProperties.getIntelligenceLookbackDays();
        var trend = marketTrendService.getMarketTrend();
        var memory = marketMemoryService.expandedMemory(lookback);
        var behavior = behaviorAnalyticsService.todayInsights();
        var edge = performanceAnalyticsService.computeEdge(lookback);

        String sym = symbol != null ? symbol.toUpperCase() : "";
        TradingSignal signal = sym.isBlank() ? null
                : signalRepository.findBySymbolOrderByTimestampDesc(sym).stream().findFirst().orElse(null);
        SymbolIntelligenceDto intel = sym.isBlank() ? null : enrichmentService.analyze(sym, signal);

        SetupNarrativeDto narrative = setupNarrativeService.narrate(intel, signal);
        SessionPriorityDto priority = sessionPriorityEngine.compute(trend, memory);
        SessionTemperatureDto temperature = sessionTemperatureService.classify(trend, memory);
        MarketPersonalityDto personality = marketPersonalityService.analyze(trend, memory);
        PersonalizedCoachingDto personalized = personalizedCoachingService.coach(edge, behavior);
        var exec = intel != null ? intel.getExecution() : null;
        String signalType = signal != null ? signal.getSignalType() : null;
        String regime = trend != null ? trend.getRegime() : null;

        return CognitionSnapshotDto.builder()
                .setupNarrative(narrative)
                .sessionPriority(priority)
                .sessionTemperature(temperature)
                .coachingFeed(coachingFeedService.feed(behavior, memory, trend))
                .marketPersonality(personality)
                .premarket(premarketPreparationService.brief(trend))
                .personalized(personalized)
                .discipline(disciplineScoreService.score(behavior))
                .events(eventStreamService.events(trend, memory, behavior, sym))
                .memoryNarrative(memoryNarrativeService.narrate(memory))
                .probabilisticGuidance(probabilisticGuidanceService.guide(signalType, regime, exec))
                .summary(summarizationService.summarize(priority, trend, memory, personalized, personality))
                .aiSessionReview(aiSessionReviewService.review(memory, edge, behavior))
                .heatmap(performanceHeatmapService.heatmap(lookback))
                .visualEmphasis(visualEmphasisService.emphasize(priority, sym))
                .timestamp(System.currentTimeMillis())
                .build();
    }
}
