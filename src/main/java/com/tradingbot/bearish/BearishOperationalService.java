package com.tradingbot.bearish;

import com.tradingbot.bearishassist.BearishAssistMode;
import com.tradingbot.bearishassist.BearishAssistService;
import com.tradingbot.executionintelligence.ExecutionIntelligenceCoordinator;
import com.tradingbot.intelligence.live.LiveScannerRollingCache;
import com.tradingbot.intelligence.live.LiveSymbolScanState;
import com.tradingbot.intelligence.snapshot.dto.IntelligenceSnapshotDtos.ScannerOpportunityDto;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.marketstructure.MarketStructureAssessment;
import com.tradingbot.replay.ReplayRuntimeMode;
import com.tradingbot.sessionintelligence.PremarketIntelligenceService;
import com.tradingbot.sessionintelligence.premarket.PremarketSnapshotDto;
import com.tradingbot.sessionintelligence.premarket.PremarketTrendState;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/** Phase 209 — coordinates bearish operational intelligence for live execution. */
@Service
@RequiredArgsConstructor
public class BearishOperationalService {

    private final BearishStructureSignalBuilder signalBuilder;
    private final BearishLongSuppressionEngine suppressionEngine;
    private final BullishDeteriorationEngine deteriorationEngine;
    private final DirectionalConflictEngine conflictEngine;
    private final BearishMarketAlignmentEngine alignmentEngine;
    private final BearishOpportunityRanker opportunityRanker;
    private final PutAssistGradeEvaluator gradeEvaluator;
    private final BearishOperationalTelemetryService telemetryService;
    private final SymbolContextRegistry symbolContextRegistry;
    private final ExecutionIntelligenceCoordinator intelligenceCoordinator;
    private final BearishAssistService bearishAssistService;
    private final ReplayRuntimeMode replayRuntimeMode;
    private final LiveScannerRollingCache rollingCache;
    private final PremarketIntelligenceService premarketIntelligenceService;

    public record OperationalAssessment(
            BearishStructureSignals signals,
            BearishLongSuppressionEngine.SuppressionResult suppression,
            BullishDeteriorationEngine.DeteriorationResult deterioration,
            DirectionalConflictEngine.ConflictResult conflict,
            BearishMarketAlignmentEngine.AlignmentResult alignment,
            PutAssistGradeEvaluator.GradeResult putGrade,
            BearishOpportunityDto ranked,
            LiveTraderDtos.BearishOperationalOverlayDto overlay
    ) {}

    public OperationalAssessment assess(LiveTraderDtos.RankedOpportunityDto opp) {
        if (replayRuntimeMode.isReplayActive()) {
            return minimal(opp);
        }
        SymbolContext ctx = symbolContextRegistry.get(opp.symbol());
        MarketStructureAssessment market = intelligenceCoordinator.currentMarketStructure();
        int exhaustion = opp.degrading() ? 60 : 25;

        BearishStructureSignals signals = signalBuilder.build(opp, ctx, market, exhaustion);
        var suppression = suppressionEngine.evaluate(signals);
        var deterioration = deteriorationEngine.evaluate(opp, signals);
        var conflict = conflictEngine.evaluate(opp, signals);
        var alignment = alignmentEngine.evaluate(market);
        var grade = gradeEvaluator.evaluate(signals, alignment.environment());
        var ranked = opportunityRanker.rank(opp, ctx, signals, alignment.environment(), deterioration.level());
        ranked = applyPremarketBearishBias(opp.symbol(), ranked);

        var suppressionAdjusted = applyPremarketSuppression(suppression, opp.symbol());
        String pmChip = premarketChip(opp.symbol());
        String chip = buildChip(suppressionAdjusted.level(), deterioration.level(), grade.grade(), opp);
        LiveTraderDtos.BearishOperationalOverlayDto overlay = new LiveTraderDtos.BearishOperationalOverlayDto(
                suppressionAdjusted.level().name(),
                deterioration.level().name(),
                conflict.level().name(),
                alignment.environment().name(),
                grade.grade().name(),
                ranked.bearishBias(),
                signals.bearishState().name(),
                grade.grade().manualEligible() && bearishAssistService.getMode() == BearishAssistMode.LONG_PLUS_PUT_ASSIST,
                chip,
                pmChip,
                mergeNotes(suppressionAdjusted, deterioration, conflict, pmChip)
        );

        telemetryService.record(opp, signals, overlay, ranked.narrative());
        return new OperationalAssessment(signals, suppressionAdjusted, deterioration, conflict, alignment, grade, ranked, overlay);
    }

    public LiveTraderDtos.RankedOpportunityDto applyToOpportunity(LiveTraderDtos.RankedOpportunityDto opp) {
        OperationalAssessment a = assess(opp);
        LiveTraderDtos.RankedOpportunityDto adjusted = applySuppressionAdjustments(opp, a);
        LiveTraderDtos.PutAssistAdvisoryDto put = adjusted.putAssist();
        if (put != null && a.putGrade().grade() != null) {
            put = new LiveTraderDtos.PutAssistAdvisoryDto(
                    put.active(), put.bearishBias(), put.bearishState(), put.breakdownProbability(),
                    put.confidence(), put.reasons(), put.blockReasons(), put.narrative(),
                    chipLabel(a.putGrade().grade()), a.putGrade().grade().name());
        }
        return adjusted.withBearishOps(a.overlay()).withPutAssist(put);
    }

    public LiveTraderDtos.RankedOpportunityDto applySuppressionAdjustments(
            LiveTraderDtos.RankedOpportunityDto opp,
            OperationalAssessment a
    ) {
        int conviction = opp.conviction();
        int dominance = opp.dominanceScore();
        String quality = opp.executionQuality();

        return switch (a.suppression().level()) {
            case WARNING -> new LiveTraderDtos.RankedOpportunityDto(
                    opp.symbol(), opp.regime(), opp.action(), opp.tone(), opp.badge(), opp.maturityState(),
                    Math.max(0, conviction - 5), opp.convictionVelocity(), opp.persistenceSeconds(),
                    opp.institutionalPressure(), opp.expansionProbability(), dominance,
                    opp.whyNow(), opp.entryZoneLabel(), opp.riskLabel(), opp.emergingFast(), opp.degrading(),
                    opp.updatedAt(), quality, opp.tradeLifecycle(), opp.velocityTrend(), opp.rvol(),
                    opp.stopLabel(), opp.targetLabel(), opp.projectedR(), opp.dataFreshness(),
                    opp.reliabilityBoost(), opp.marketAligned(), opp.lastTickMs(), opp.putAssist(), opp.bearishOps());
            case DOWNGRADE -> new LiveTraderDtos.RankedOpportunityDto(
                    opp.symbol(), opp.regime(), opp.action(), opp.tone(), opp.badge(), opp.maturityState(),
                    Math.max(0, conviction - 12), opp.convictionVelocity(), opp.persistenceSeconds(),
                    opp.institutionalPressure(), opp.expansionProbability(), Math.max(0, dominance - 25),
                    opp.whyNow(), opp.entryZoneLabel(), opp.riskLabel(), opp.emergingFast(), true,
                    opp.updatedAt(), downgradedQuality(quality), opp.tradeLifecycle(), opp.velocityTrend(), opp.rvol(),
                    opp.stopLabel(), opp.targetLabel(), opp.projectedR(), opp.dataFreshness(),
                    opp.reliabilityBoost(), false, opp.lastTickMs(), opp.putAssist(), opp.bearishOps());
            case BLOCK -> new LiveTraderDtos.RankedOpportunityDto(
                    opp.symbol(), opp.regime(), "AVOID", "RED", opp.badge(), opp.maturityState(),
                    Math.max(0, conviction - 20), opp.convictionVelocity(), opp.persistenceSeconds(),
                    opp.institutionalPressure(), opp.expansionProbability(), Math.max(0, dominance - 40),
                    opp.whyNow(), opp.entryZoneLabel(), "HIGH", opp.emergingFast(), true,
                    opp.updatedAt(), "LOW", opp.tradeLifecycle(), opp.velocityTrend(), opp.rvol(),
                    opp.stopLabel(), opp.targetLabel(), opp.projectedR(), opp.dataFreshness(),
                    opp.reliabilityBoost(), false, opp.lastTickMs(), opp.putAssist(), opp.bearishOps());
            case NONE -> opp;
        };
    }

    public boolean blocksAutoExecution(LiveTraderDtos.RankedOpportunityDto opp) {
        if (opp.bearishOps() != null) {
            if (LongSuppressionLevel.BLOCK.name().equals(opp.bearishOps().longSuppression())) {
                return true;
            }
            if (DirectionalConflict.HIGH.name().equals(opp.bearishOps().directionalConflict())) {
                return true;
            }
        }
        OperationalAssessment a = assess(opp);
        return a.suppression().level().blocksAutoExecution()
                || a.conflict().level().suppressesAutoExecution();
    }

    /** Phase 209 — attach bearish operational fields to scanner rows. */
    public ScannerOpportunityDto enrichScanner(ScannerOpportunityDto dto) {
        if (replayRuntimeMode.isReplayActive()) {
            return dto;
        }
        LiveSymbolScanState state = rollingCache.stateFor(dto.symbol());
        LiveTraderDtos.RankedOpportunityDto stub = scannerToRanked(dto, state);
        OperationalAssessment a = assess(stub);
        var o = a.overlay();
        String chip = mergeScannerChip(o.operationalChip(), o.premarketChip(),
                premarketIntelligenceService.scannerRankLabel(dto.symbol()));
        return new ScannerOpportunityDto(
                dto.symbol(), dto.opportunityType(), dto.action(), dto.tone(), dto.badge(),
                dto.convictionScore(), dto.expansionProbability(), dto.continuationPersistence(),
                dto.triggerIntegrity(), dto.institutionalPressure(), dto.exhaustionProbability(),
                dto.executionQuality(), dto.entryZoneLabel(), dto.riskLabel(), dto.whyNow(),
                dto.windowLabel(), dto.rvolLabel(),
                o.bearishBias(), o.bearishLifecycle(), o.longSuppression(), o.deterioration(),
                o.putAssistActive(), chip);
    }

    private static LiveTraderDtos.RankedOpportunityDto scannerToRanked(
            ScannerOpportunityDto dto,
            LiveSymbolScanState state
    ) {
        double rvol = 1.0;
        if (dto.rvolLabel() != null && dto.rvolLabel().contains("x")) {
            try {
                rvol = Double.parseDouble(dto.rvolLabel().replaceAll("[^0-9.]", ""));
            } catch (Exception ignored) {
            }
        }
        boolean degrading = dto.deteriorationLevel() != null
                && !"HEALTHY".equals(dto.deteriorationLevel());
        return new LiveTraderDtos.RankedOpportunityDto(
                dto.symbol(), dto.opportunityType(), dto.action(), dto.tone(), dto.badge(), "DEVELOPING",
                dto.convictionScore(), state.convictionVelocity(), dto.continuationPersistence(),
                dto.institutionalPressure(), dto.expansionProbability(), state.dominanceScore(),
                dto.whyNow(), dto.entryZoneLabel(), dto.riskLabel(), false, degrading,
                System.currentTimeMillis(), "MEDIUM", "PERSISTING", "FLAT", rvol,
                "—", "—", "—", "LIVE", 0, !"RED".equals(dto.tone()), state.lastEvalMs(), null, null);
    }

    private static OperationalAssessment minimal(LiveTraderDtos.RankedOpportunityDto opp) {
        var overlay = new LiveTraderDtos.BearishOperationalOverlayDto(
                "NONE", "HEALTHY", "NONE", "NEUTRAL", "AVOID", 0,
                "NEUTRAL", false, null, null, List.of());
        return new OperationalAssessment(
                new BearishStructureSignals(0, 0, 0, 0, 1, 0, false, false, false,
                        com.tradingbot.bearishassist.BearishBiasState.EARLY_WEAKNESS, "NEUTRAL", null, List.of()),
                new BearishLongSuppressionEngine.SuppressionResult(LongSuppressionLevel.NONE, List.of()),
                new BullishDeteriorationEngine.DeteriorationResult(BullishDeteriorationLevel.HEALTHY, List.of()),
                new DirectionalConflictEngine.ConflictResult(DirectionalConflict.NONE, List.of()),
                new BearishMarketAlignmentEngine.AlignmentResult(BearishEnvironment.NEUTRAL, List.of()),
                new PutAssistGradeEvaluator.GradeResult(PutAssistGrade.AVOID, List.of()),
                new BearishOpportunityDto(opp.symbol(), "NEUTRAL", "LOW", 0, 0, 0,
                        BullishDeteriorationLevel.HEALTHY, PutAssistGrade.AVOID, "", List.of()),
                overlay);
    }

    private static String buildChip(
            LongSuppressionLevel sup,
            BullishDeteriorationLevel det,
            PutAssistGrade grade,
            LiveTraderDtos.RankedOpportunityDto opp
    ) {
        if (sup == LongSuppressionLevel.BLOCK) return "LONG BLOCKED";
        if (det == BullishDeteriorationLevel.COLLAPSING) return "COLLAPSING";
        if (grade == PutAssistGrade.A_PLUS) return "PUT A+";
        if (grade == PutAssistGrade.A) return "PUT A";
        if (opp.degrading()) return "DETERIORATING";
        return null;
    }

    private static String chipLabel(PutAssistGrade g) {
        return switch (g) {
            case A_PLUS -> "PUT A+";
            case A -> "PUT A";
            case B -> "PUT B";
            case AVOID -> null;
        };
    }

    private static String downgradedQuality(String q) {
        if ("INSTITUTIONAL".equals(q)) return "HIGH";
        if ("HIGH".equals(q)) return "MEDIUM";
        return "LOW";
    }

    private BearishOpportunityDto applyPremarketBearishBias(String symbol, BearishOpportunityDto ranked) {
        if (!premarketIntelligenceService.enabled()) return ranked;
        int mod = premarketIntelligenceService.bearishModifier(symbol);
        if (mod == 0) return ranked;
        return new BearishOpportunityDto(
                ranked.symbol(), ranked.bearishRegime(), ranked.breakdownQuality(),
                Math.min(100, ranked.bearishBias() + mod),
                ranked.continuationProbability(), ranked.squeezeRisk(),
                ranked.deteriorationLevel(), ranked.putGrade(), ranked.narrative(), ranked.reasons());
    }

    private BearishLongSuppressionEngine.SuppressionResult applyPremarketSuppression(
            BearishLongSuppressionEngine.SuppressionResult suppression,
            String symbol
    ) {
        if (!premarketIntelligenceService.enabled()) return suppression;
        return premarketIntelligenceService.get(symbol).map(pm -> {
            if (suppression.level() == LongSuppressionLevel.BLOCK) return suppression;
            if (pm.trendState() == PremarketTrendState.FAILED_GAP
                    || pm.trendState() == PremarketTrendState.RECLAIM_FAILURE) {
                List<String> reasons = new ArrayList<>(suppression.reasons());
                reasons.add("PM failed gap / reclaim failure");
                return new BearishLongSuppressionEngine.SuppressionResult(LongSuppressionLevel.DOWNGRADE, reasons);
            }
            if (pm.premarketDistribution() && suppression.level() == LongSuppressionLevel.NONE) {
                List<String> reasons = new ArrayList<>(suppression.reasons());
                reasons.add("PM distribution");
                return new BearishLongSuppressionEngine.SuppressionResult(LongSuppressionLevel.WARNING, reasons);
            }
            return suppression;
        }).orElse(suppression);
    }

    private String premarketChip(String symbol) {
        if (!premarketIntelligenceService.enabled()) return null;
        return premarketIntelligenceService.get(symbol)
                .map(PremarketSnapshotDto::operationalChip)
                .orElse(null);
    }

    private static String mergeScannerChip(String ops, String pm, String rankLabel) {
        if (rankLabel != null && !rankLabel.isBlank()) return rankLabel;
        if (pm != null && !pm.isBlank()) return pm;
        return ops;
    }

    private static List<String> mergeNotes(
            BearishLongSuppressionEngine.SuppressionResult s,
            BullishDeteriorationEngine.DeteriorationResult d,
            DirectionalConflictEngine.ConflictResult c,
            String pmChip
    ) {
        List<String> all = new ArrayList<>();
        all.addAll(s.reasons());
        all.addAll(d.reasons());
        all.addAll(c.reasons());
        if (pmChip != null && !pmChip.isBlank()) all.add("PM: " + pmChip);
        return all.stream().distinct().limit(6).toList();
    }
}
