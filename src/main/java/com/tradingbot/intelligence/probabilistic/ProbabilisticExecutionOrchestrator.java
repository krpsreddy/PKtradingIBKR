package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.cognition.CognitionPartDtos.PersonalizedCoachingDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.*;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.intelligence.*;
import com.tradingbot.intelligence.cognition.PersonalizedCoachingService;
import com.tradingbot.intelligence.dto.ExecutionIntelligenceDto;
import com.tradingbot.intelligence.dto.SymbolIntelligenceDto;
import com.tradingbot.intelligence.historical.MovementIntelligenceService;
import com.tradingbot.intelligence.historical.SetupStatisticsService;
import com.tradingbot.intelligence.situational.SetupMaturityService;
import com.tradingbot.intelligence.situational.WhyNowService;
import com.tradingbot.intelligence.options.OptionsExecutionOrchestrator;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.repository.TradingSignalRepository;
import com.tradingbot.services.MarketTrendService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class ProbabilisticExecutionOrchestrator {

    private final ExpectedMoveModelService expectedMoveModelService;
    private final SetupHalfLifeService setupHalfLifeService;
    private final ProbabilityDecayService probabilityDecayService;
    private final FailureSignatureService failureSignatureService;
    private final SetupDnaService setupDnaService;
    private final TradeExpectancyService tradeExpectancyService;
    private final AdaptiveExitService adaptiveExitService;
    private final DecisionQualityService decisionQualityService;
    private final BiasDetectionService biasDetectionService;
    private final MarketTrustScoreService marketTrustScoreService;
    private final AttentionSaturationService attentionSaturationService;
    private final OptionsExpectancyService optionsExpectancyService;
    private final RegimeAdaptationService regimeAdaptationService;
    private final MovementIntelligenceService movementIntelligenceService;
    private final PersonalizedCoachingService personalizedCoachingService;
    private final IntelligenceEnrichmentService enrichmentService;
    private final MarketTrendService marketTrendService;
    private final MarketMemoryService marketMemoryService;
    private final BehaviorAnalyticsService behaviorAnalyticsService;
    private final TraderPerformanceAnalyticsService performanceAnalyticsService;
    private final WhyNowService whyNowService;
    private final SetupMaturityService setupMaturityService;
    private final OptionsExecutionOrchestrator optionsExecutionOrchestrator;
    private final TradingSignalRepository signalRepository;
    private final TradingProperties tradingProperties;

    private final ConcurrentHashMap<String, CachedSnapshot> cache = new ConcurrentHashMap<>();

    public ProbabilisticExecutionSnapshotDto snapshot(String symbol, String signalTypeOverride) {
        String sym = symbol != null ? symbol.toUpperCase() : "";
        String cacheKey = sym + "|" + (signalTypeOverride != null ? signalTypeOverride : "");
        CachedSnapshot cached = cache.get(cacheKey);
        if (cached != null && System.currentTimeMillis() - cached.ts < 15_000) {
            return cached.dto;
        }

        var trend = marketTrendService.getMarketTrend();
        int lookback = tradingProperties.getIntelligenceLookbackDays();
        var memory = marketMemoryService.expandedMemory(lookback);
        var behavior = behaviorAnalyticsService.todayInsights();
        var edge = performanceAnalyticsService.computeEdge(lookback);

        TradingSignal signal = sym.isBlank() ? null
                : signalRepository.findBySymbolOrderByTimestampDesc(sym).stream().findFirst().orElse(null);
        SymbolIntelligenceDto intel = sym.isBlank() ? null : enrichmentService.analyze(sym, signal);

        String signalType = signalTypeOverride != null ? signalTypeOverride
                : (signal != null ? signal.getSignalType() : null);
        String regime = trend != null ? trend.getRegime() : "TRENDING_BULL";

        if (signalType == null || signalType.isBlank() || "WATCH".equals(signalType)) {
            return emptySnapshot(trend, memory);
        }

        ExecutionIntelligenceDto exec = intel != null ? intel.getExecution() : null;
        var deterioration = exec != null ? exec.getDeterioration() : null;
        long ageMin = intel != null && intel.getFreshness() != null ? intel.getFreshness().getAgeMinutes() : 0;
        double rvol = signal != null && signal.getRelativeVolume() != null
                ? signal.getRelativeVolume().doubleValue() : 2.0;
        boolean vwapHold = intel != null && intel.getExtended() != null && !intel.getExtended().isExtended();
        boolean deteriorating = deterioration != null && !"STABLE".equals(deterioration.getState());
        String entryQuality = mapEntryQuality(intel);
        Double estRr = exec != null && exec.getRiskReward() != null ? exec.getRiskReward().getRiskRewardRatio() : null;

        ExpectedMoveDto expectedMove = expectedMoveModelService.model(signalType, sym, regime);
        SetupHalfLifeDto halfLife = setupHalfLifeService.halfLife(signalType, (int) ageMin);
        ProbabilityDecayDto decay = probabilityDecayService.decay(signalType, regime, (int) ageMin, rvol, vwapHold, deteriorating);
        FailureSignatureDto failure = failureSignatureService.analyze(signalType, deterioration, rvol, vwapHold, false);
        SetupDnaDto dna = setupDnaService.personality(signalType, sym);
        TradeExpectancyDto expectancy = tradeExpectancyService.expectancy(signalType, estRr);
        AdaptiveExitDto exit = adaptiveExitService.guidance(decay, failure, (int) ageMin,
                halfLife.getHalfLifeMinutes(), decay.getExhaustionRisk(), rvol);
        DecisionQualityDto decision = decisionQualityService.evaluate(signalType, exec, entryQuality,
                intel != null && intel.isRegimeAligned());
        boolean regimeBull = regime != null && regime.contains("BULL");
        List<BiasAlertDto> biases = biasDetectionService.detect(entryQuality, regimeBull, signalType);
        MarketTrustDto trust = marketTrustScoreService.score(trend, memory);
        var movement = movementIntelligenceService.analyze(SetupStatisticsService.normalize(signalType), sym);
        OptionsExpectancyDto options = optionsExpectancyService.analyze(signalType, (int) ageMin, halfLife,
                movement.getMovePersistenceProbability(), entryQuality);
        RegimeAdaptationDto regimeAdapt = regimeAdaptationService.adapt(signalType, regime);
        WhyNowDto whyNow = whyNowService.explain(signalType, signal, intel, trend);
        SetupMaturityDto maturity = setupMaturityService.maturity(signalType, signal, intel, deterioration);
        OptionsExecutionSnapshotDto optionsExecution = optionsExecutionOrchestrator.snapshot(
                signalType, regime, entryQuality, (int) ageMin, rvol,
                intel != null && intel.getExtended() != null && intel.getExtended().isExtended(),
                intel != null && intel.isRegimeAligned(), deteriorating,
                expectedMove, halfLife, decay, failure, exit, trend, memory, intel);

        PersonalizedCoachingDto coaching = personalizedCoachingService.coach(edge, behavior);
        List<String> coachingEvolution = buildCoachingEvolution(coaching, decay, failure, dna, expectancy);
        List<String> topPriorities = attentionSaturationService.prioritize(
                memory.getNarratives(), biases, coachingEvolution);

        ProbabilisticExecutionSnapshotDto dto = ProbabilisticExecutionSnapshotDto.builder()
                .expectedMove(expectedMove)
                .halfLife(halfLife)
                .probabilityDecay(decay)
                .failureSignature(failure)
                .setupDna(dna)
                .expectancy(expectancy)
                .adaptiveExit(exit)
                .decisionQuality(decision)
                .marketTrust(trust)
                .optionsExpectancy(options)
                .biasAlerts(biases)
                .coachingEvolution(coachingEvolution)
                .topPriorities(topPriorities)
                .regimeAdaptation(regimeAdapt)
                .whyNow(whyNow)
                .setupMaturity(maturity)
                .optionsExecution(optionsExecution)
                .timestamp(System.currentTimeMillis())
                .build();

        cache.put(cacheKey, new CachedSnapshot(dto, System.currentTimeMillis()));
        return dto;
    }

    public ReplayProbabilisticDto replay(String symbol, String signalType, int barIndex) {
        var snap = snapshot(symbol, signalType);
        int simulatedAge = barIndex * 5;
        SetupHalfLifeDto halfLife = setupHalfLifeService.halfLife(signalType, simulatedAge);
        ProbabilityDecayDto decay = probabilityDecayService.decay(signalType, "TRENDING_BULL", simulatedAge, 1.8, true, false);
        FailureSignatureDto failure = failureSignatureService.analyze(signalType, null, 1.8, true, false);
        AdaptiveExitDto exit = adaptiveExitService.guidance(decay, failure, simulatedAge,
                halfLife.getHalfLifeMinutes(), decay.getExhaustionRisk(), 1.8);

        return ReplayProbabilisticDto.builder()
                .symbol(symbol.toUpperCase())
                .barIndex(barIndex)
                .probabilities(decay)
                .expectedMove(snap.getExpectedMove())
                .exitGuidance(exit)
                .failure(failure)
                .build();
    }

    private List<String> buildCoachingEvolution(PersonalizedCoachingDto coaching, ProbabilityDecayDto decay,
                                                FailureSignatureDto failure, SetupDnaDto dna,
                                                TradeExpectancyDto expectancy) {
        List<String> lines = new ArrayList<>();
        if (coaching != null && coaching.getInsights() != null) {
            lines.addAll(coaching.getInsights().stream().limit(2).toList());
        }
        if (decay.getContinuationCurrent() < decay.getContinuationStart() - 10) {
            lines.add("Continuation probability decaying — tighten management");
        }
        if (failure.getFailureProbability() >= 35) {
            lines.add("Failure signatures emerging — honor invalidation");
        }
        if (dna != null) {
            lines.add("Setup personality: " + dna.getPersonality());
        }
        if (expectancy.getHistoricalExpectancyR() != null && expectancy.getHistoricalExpectancyR() > 0) {
            lines.add(String.format("Historical expectancy: +%.2fR — trust process", expectancy.getHistoricalExpectancyR()));
        }
        return lines;
    }

    private ProbabilisticExecutionSnapshotDto emptySnapshot(
            com.tradingbot.api.dto.MarketTrendDto trend, com.tradingbot.api.dto.MarketMemoryDto memory) {
        return ProbabilisticExecutionSnapshotDto.builder()
                .marketTrust(marketTrustScoreService.score(trend, memory))
                .topPriorities(memory != null ? memory.getNarratives().stream().limit(3).toList() : List.of())
                .timestamp(System.currentTimeMillis())
                .build();
    }

    private String mapEntryQuality(SymbolIntelligenceDto intel) {
        if (intel == null || intel.getFreshness() == null) return "GOOD";
        return switch (intel.getFreshness().getFreshness()) {
            case "FRESH" -> "EARLY";
            case "ACTIVE" -> "GOOD";
            case "AGING" -> "LATE";
            case "STALE" -> "CHASING";
            default -> "GOOD";
        };
    }

    private record CachedSnapshot(ProbabilisticExecutionSnapshotDto dto, long ts) {}
}
