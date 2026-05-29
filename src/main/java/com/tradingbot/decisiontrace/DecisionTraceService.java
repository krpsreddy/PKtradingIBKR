package com.tradingbot.decisiontrace;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.bearishassist.PutAssistAssessment;
import com.tradingbot.entry.EntryQualityAssessment;
import com.tradingbot.entry.EntryQualityState;
import com.tradingbot.executionintelligence.ExecutionIntelligenceCoordinator;
import com.tradingbot.executionintelligence.OpportunityIntelligenceSnapshot;
import com.tradingbot.exit.ExitIntelligenceAssessment;
import com.tradingbot.intelligence.live.MarketSessionClock;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.livetrader.portfolio.OrchestrationState;
import com.tradingbot.livetrader.portfolio.PortfolioDecision;
import com.tradingbot.livetrader.portfolio.PortfolioExposureModel;
import com.tradingbot.marketstructure.MarketStructureAssessment;
import com.tradingbot.models.DecisionTraceRecord;
import com.tradingbot.models.ExecutionTelemetryRecord;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.refinement.ContinuationCaptureEfficiency;
import com.tradingbot.reliability.RegimeReliabilityLearningEngine;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;

/**
 * Phase 201 — explainable execution intelligence memory (async, append-only).
 */
@Slf4j
@Service
public class DecisionTraceService {

    private final DecisionTraceRepository repository;
    private final DecisionNarrativeBuilder narrativeBuilder;
    private final ExecutionIntelligenceCoordinator intelligenceCoordinator;
    private final RegimeReliabilityLearningEngine reliabilityLearning;
    private final SymbolContextRegistry symbolContextRegistry;
    private final MarketSessionClock sessionClock;
    private final ObjectMapper objectMapper;
    private final Executor decisionTraceExecutor;

    private final Map<String, Long> dedupeKeys = new ConcurrentHashMap<>();

    public DecisionTraceService(
            DecisionTraceRepository repository,
            DecisionNarrativeBuilder narrativeBuilder,
            ExecutionIntelligenceCoordinator intelligenceCoordinator,
            RegimeReliabilityLearningEngine reliabilityLearning,
            SymbolContextRegistry symbolContextRegistry,
            MarketSessionClock sessionClock,
            ObjectMapper objectMapper,
            @Qualifier("decisionTraceExecutor") Executor decisionTraceExecutor
    ) {
        this.repository = repository;
        this.narrativeBuilder = narrativeBuilder;
        this.intelligenceCoordinator = intelligenceCoordinator;
        this.reliabilityLearning = reliabilityLearning;
        this.symbolContextRegistry = symbolContextRegistry;
        this.sessionClock = sessionClock;
        this.objectMapper = objectMapper;
        this.decisionTraceExecutor = decisionTraceExecutor;
    }

    public void traceEntry(
            PaperExecutionRecord paper,
            LiveTraderDtos.RankedOpportunityDto opp,
            int queueRank,
            String orchestrationReason
    ) {
        OpportunityIntelligenceSnapshot intel = intelligenceCoordinator.assess(opp);
        EntryReasoningSnapshot snap = buildEntrySnapshot(paper, opp, intel, queueRank, orchestrationReason);
        persistAsync(toRecord(snap, paper.getId(), null, "ENTRY", null));
    }

    public ExitReasoningSnapshot traceExit(
            PaperExecutionRecord paper,
            ExecutionTelemetryRecord telemetry,
            ExitIntelligenceAssessment exit,
            int liveDominance,
            int livePersistence,
            int liveVelocity,
            String velocityTrend
    ) {
        double capture = ContinuationCaptureEfficiency.fromPaper(paper);
        ExitReasoningSnapshot snap = buildExitSnapshot(
                paper, telemetry, exit, liveDominance, livePersistence, liveVelocity, velocityTrend, capture);
        persistAsync(toRecord(snap, paper.getId(), telemetry != null ? telemetry.getId() : null, "EXIT", capture));
        reliabilityLearning.ingestExitReasoning(snap);
        return snap;
    }

    public void tracePortfolioDecision(
            LiveTraderDtos.RankedOpportunityDto opp,
            PortfolioDecision decision,
            PortfolioExposureModel exposure,
            int queueRank
    ) {
        OpportunityIntelligenceSnapshot intel = intelligenceCoordinator.assess(opp);
        OrchestrationState state = decision.state();

        if (state == OrchestrationState.REPLACEMENT_CANDIDATE || decision.replacementAdvisory()) {
            traceReplacement(opp, exposure, intel);
            return;
        }

        if (state == OrchestrationState.QUEUE) {
            traceQueueOrSuppress(opp, decision, exposure, intel, DecisionTraceType.QUEUE, queueRank);
            return;
        }

        if (isRejectionState(state)) {
            traceQueueOrSuppress(opp, decision, exposure, intel, DecisionTraceType.REJECTION, queueRank);
            return;
        }

        if (state == OrchestrationState.SUPPRESSED) {
            traceQueueOrSuppress(opp, decision, exposure, intel, DecisionTraceType.SUPPRESSION, queueRank);
        }
    }

    public void tracePutAssist(
            LiveTraderDtos.RankedOpportunityDto opp,
            PutAssistAssessment assessment,
            MarketStructureAssessment market
    ) {
        if (assessment == null || !assessment.active()) return;
        String dedupe = "PUT:" + opp.symbol() + ":" + assessment.bearishBias();
        if (shouldDedupe(dedupe)) return;

        BearishReasoningSnapshot snap = new BearishReasoningSnapshot(
                Instant.now(),
                opp.symbol(),
                opp.regime(),
                assessment.bearishBias(),
                assessment.bearishState().name(),
                assessment.breakdownProbability().name(),
                assessment.confidence().name(),
                true,
                assessment.reasons(),
                assessment.blockReasons(),
                structureLabel(market),
                assessment.narrative()
        );
        persistAsync(toRecord(snap, null, null, "PUT_ASSIST", null));
    }

    public void traceAutoEntryBlocked(LiveTraderDtos.RankedOpportunityDto opp, String reason) {
        OpportunityIntelligenceSnapshot intel = intelligenceCoordinator.assess(opp);
        PortfolioDecision pseudo = PortfolioDecision.suppress(OrchestrationState.REJECTED_QUALITY, reason);
        traceQueueOrSuppress(opp, pseudo, PortfolioExposureModel.empty(), intel, DecisionTraceType.REJECTION, -1);
    }

    public EntryReasoningSnapshot buildEntrySnapshot(
            PaperExecutionRecord paper,
            LiveTraderDtos.RankedOpportunityDto opp,
            OpportunityIntelligenceSnapshot intel,
            int queueRank,
            String orchestrationReason
    ) {
        SymbolContext ctx = symbolContextRegistry.get(opp.symbol());
        MarketStructureAssessment market = intel.marketStructure();
        EntryQualityAssessment entry = intel.entryQuality();
        String session = sessionClock.windowLabel(sessionClock.sessionMinutesSinceRthOpen());
        int reliabilityMod = reliabilityLearning.rankingModifier(
                opp.regime(), market, opp.rvol(), session);

        EntryReasoningSnapshot snap = new EntryReasoningSnapshot(
                Instant.now(),
                opp.symbol(),
                opp.regime(),
                structureLabel(market),
                opp.tradeLifecycle(),
                entry.state().name(),
                opp.conviction(),
                opp.dominanceScore(),
                opp.persistenceSeconds(),
                opp.convictionVelocity(),
                opp.velocityTrend(),
                opp.rvol(),
                vwapRelation(ctx),
                emaAlignment(ctx),
                sectorNote(opp),
                breadthNote(market),
                reliabilityMod,
                opp.executionQuality(),
                orchestrationReason != null ? orchestrationReason : "AUTO_PAPER",
                queueRank >= 0 ? queueRank : null,
                null,
                session,
                opp.expansionProbability(),
                secondLegGuess(opp),
                exhaustionGuess(opp),
                opp.whyNow(),
                intel.adjustedConviction(),
                intel.adjustedDominance(),
                ""
        );
        String narrative = narrativeBuilder.entryNarrative(snap);
        return new EntryReasoningSnapshot(
                snap.timestamp(), snap.symbol(), snap.regime(), snap.marketStructure(),
                snap.lifecycle(), snap.entryQuality(), snap.conviction(), snap.dominance(),
                snap.persistence(), snap.velocity(), snap.velocityTrend(), snap.rvol(),
                snap.vwapRelation(), snap.emaAlignment(), snap.sectorStrength(), snap.breadth(),
                snap.reliabilityScore(), snap.executionQuality(), snap.orchestrationState(),
                snap.queueRank(), snap.replacementCandidate(), snap.sessionPhase(),
                snap.continuationProbability(), snap.secondLegProbability(), snap.exhaustionScore(),
                snap.whyNow(), snap.adjustedConviction(), snap.adjustedDominance(), narrative);
    }

    private ExitReasoningSnapshot buildExitSnapshot(
            PaperExecutionRecord paper,
            ExecutionTelemetryRecord telemetry,
            ExitIntelligenceAssessment exit,
            int liveDominance,
            int livePersistence,
            int liveVelocity,
            String velocityTrend,
            double capturePct
    ) {
        MarketStructureAssessment market = intelligenceCoordinator.currentMarketStructure();
        int entryPersist = telemetry != null && telemetry.getPersistence() != null
                ? telemetry.getPersistence() : 0;
        Integer holdSec = null;
        if (paper.getClosedAt() != null && paper.getSubmittedAt() != null) {
            holdSec = (int) java.time.Duration.between(paper.getSubmittedAt(), paper.getClosedAt()).getSeconds();
        }
        ExitReasoningSnapshot base = new ExitReasoningSnapshot(
                Instant.now(),
                paper.getSymbol(),
                paper.getRegime(),
                exit.state().name(),
                livePersistence,
                entryPersist,
                liveDominance,
                liveVelocity,
                velocityTrend,
                40,
                exit.reason() != null && exit.reason().toLowerCase(Locale.US).contains("vwap"),
                30,
                Math.max(0, entryPersist - livePersistence),
                structureLabel(market),
                paper.getRealizedR() != null ? paper.getRealizedR().doubleValue() : null,
                capturePct * 100,
                holdSec,
                paper.getMfeR() != null ? paper.getMfeR().doubleValue() : null,
                paper.getMaeR() != null ? paper.getMaeR().doubleValue() : null,
                exit.reason(),
                ""
        );
        return new ExitReasoningSnapshot(
                base.timestamp(), base.symbol(), base.regime(), base.exitState(),
                base.persistenceAtExit(), base.persistenceAtEntry(), base.dominanceAtExit(),
                base.velocityAtExit(), base.velocityTrend(), base.exhaustionScore(),
                base.vwapFailure(), base.secondLegProbability(), base.continuationDeterioration(),
                base.marketStructureShift(), base.realizedR(), base.continuationCapturePct(),
                base.holdDurationSec(), base.mfeR(), base.maeR(), base.trendQualityNote(),
                narrativeBuilder.exitNarrative(base));
    }

    private void traceReplacement(
            LiveTraderDtos.RankedOpportunityDto opp,
            PortfolioExposureModel exposure,
            OpportunityIntelligenceSnapshot intel
    ) {
        String dedupe = "REPL:" + opp.symbol() + ":" + exposure.symbol();
        if (shouldDedupe(dedupe)) return;

        ReplacementReasoningSnapshot snap = new ReplacementReasoningSnapshot(
                Instant.now(),
                opp.symbol(),
                opp.regime(),
                exposure.symbol(),
                exposure.regime(),
                exposure.lifecycle(),
                opp.dominanceScore(),
                exposure.dominance(),
                opp.conviction(),
                exposure.conviction(),
                opp.dominanceScore() - exposure.dominance(),
                opp.conviction() - exposure.conviction(),
                opp.velocityTrend(),
                exposure.velocityTrend(),
                structureLabel(intel.marketStructure()),
                intel.entryQuality().state().name(),
                ""
        );
        String narrative = narrativeBuilder.replacementNarrative(snap);
        snap = new ReplacementReasoningSnapshot(
                snap.timestamp(), snap.symbol(), snap.regime(), snap.activeSymbol(),
                snap.activeRegime(), snap.activeLifecycle(), snap.incomingDominance(),
                snap.activeDominance(), snap.incomingConviction(), snap.activeConviction(),
                snap.dominanceGap(), snap.convictionGap(), snap.incomingVelocityTrend(),
                snap.activeVelocityTrend(), snap.marketStructure(), snap.entryQuality(), narrative);
        persistAsync(toRecord(snap, null, null, "REPLACEMENT", null));
    }

    private void traceQueueOrSuppress(
            LiveTraderDtos.RankedOpportunityDto opp,
            PortfolioDecision decision,
            PortfolioExposureModel exposure,
            OpportunityIntelligenceSnapshot intel,
            DecisionTraceType type,
            int queueRank
    ) {
        String dedupe = type.name() + ":" + opp.symbol() + ":" + decision.state() + ":" + decision.reason();
        if (shouldDedupe(dedupe)) return;

        int reliabilityMod = reliabilityLearning.rankingModifier(
                opp.regime(), intel.marketStructure(), opp.rvol(),
                sessionClock.windowLabel(sessionClock.sessionMinutesSinceRthOpen()));

        Integer gap = exposure.hasActive()
                ? opp.dominanceScore() - exposure.dominance()
                : null;

        SuppressionReasoningSnapshot snap = new SuppressionReasoningSnapshot(
                Instant.now(),
                opp.symbol(),
                opp.regime(),
                type,
                decision.state().name(),
                categorizeRejection(decision),
                structureLabel(intel.marketStructure()),
                intel.entryQuality().state().name(),
                opp.tradeLifecycle(),
                opp.conviction(),
                opp.dominanceScore(),
                opp.persistenceSeconds(),
                opp.rvol(),
                reliabilityMod,
                intelligenceCoordinator.macroAllowsRegime(opp.regime()),
                intel.autoEntryAllowed(),
                exposure.hasActive() ? exposure.symbol() : null,
                exposure.hasActive() ? "vs " + exposure.symbol() : null,
                gap,
                ""
        );
        String narrative = narrativeBuilder.suppressionNarrative(snap);
        snap = new SuppressionReasoningSnapshot(
                snap.timestamp(), snap.symbol(), snap.regime(), snap.traceType(),
                snap.orchestrationState(), snap.rejectionCategory(), snap.marketStructure(),
                snap.entryQuality(), snap.lifecycle(), snap.conviction(), snap.dominance(),
                snap.persistence(), snap.rvol(), snap.reliabilityModifier(), snap.macroAllowed(),
                snap.autoEntryAllowed(), snap.activeSymbol(), snap.correlationNote(),
                snap.dominanceGap(), narrative);
        persistAsync(toRecord(snap, null, null, type.name(), null));
        reliabilityLearning.ingestRejectionReasoning(snap);
    }

    private void persistAsync(DecisionTraceRecord record) {
        decisionTraceExecutor.execute(() -> {
            try {
                repository.save(record);
            } catch (Exception ex) {
                log.debug("Decision trace persist failed: {}", ex.getMessage());
            }
        });
    }

    private DecisionTraceRecord toRecord(
            DecisionReasoningSnapshot snap,
            Long paperId,
            Long telemetryId,
            String outcome,
            Double capturePct
    ) {
        String json = writeJson(snap);
        String narrative = extractNarrative(snap);
        DecisionTraceRecord.DecisionTraceRecordBuilder b = DecisionTraceRecord.builder()
                .decisionType(snap.traceType().name())
                .symbol(snap.symbol())
                .regime(snap.regime())
                .narrative(narrative)
                .snapshotJson(json)
                .outcome(outcome)
                .paperExecutionId(paperId)
                .telemetryId(telemetryId)
                .recordedAt(snap.timestamp());

        if (snap instanceof EntryReasoningSnapshot e) {
            b.marketStructure(e.marketStructure())
                    .entryQuality(e.entryQuality())
                    .lifecycle(e.lifecycle())
                    .sessionType(e.sessionPhase())
                    .conviction(e.conviction())
                    .dominance(e.dominance())
                    .persistence(e.persistence())
                    .rvol(BigDecimal.valueOf(e.rvol()).setScale(3, RoundingMode.HALF_UP))
                    .orchestrationState(e.orchestrationState());
        } else if (snap instanceof ExitReasoningSnapshot x) {
            b.marketStructure(x.marketStructureShift())
                    .exitState(x.exitState())
                    .lifecycle(x.regime())
                    .sessionType("EXIT")
                    .persistence(x.persistenceAtExit())
                    .dominance(x.dominanceAtExit())
                    .realizedR(x.realizedR() != null ? BigDecimal.valueOf(x.realizedR()) : null)
                    .continuationCapturePct(x.continuationCapturePct() != null
                            ? BigDecimal.valueOf(x.continuationCapturePct()) : null);
        } else if (snap instanceof SuppressionReasoningSnapshot s) {
            b.marketStructure(s.marketStructure())
                    .entryQuality(s.entryQuality())
                    .lifecycle(s.lifecycle())
                    .orchestrationState(s.orchestrationState())
                    .rejectionCategory(s.rejectionCategory())
                    .conviction(s.conviction())
                    .dominance(s.dominance())
                    .persistence(s.persistence())
                    .rvol(BigDecimal.valueOf(s.rvol()).setScale(3, RoundingMode.HALF_UP));
        } else if (snap instanceof ReplacementReasoningSnapshot r) {
            b.marketStructure(r.marketStructure())
                    .entryQuality(r.entryQuality())
                    .orchestrationState(OrchestrationState.REPLACEMENT_CANDIDATE.name())
                    .conviction(r.incomingConviction())
                    .dominance(r.incomingDominance());
        } else if (snap instanceof BearishReasoningSnapshot bSnap) {
            b.marketStructure(bSnap.marketStructure())
                    .entryQuality(bSnap.confidence())
                    .lifecycle(bSnap.bearishState())
                    .rejectionCategory(bSnap.active() ? "PUT_ASSIST_ACTIVE" : "PUT_ASSIST_BLOCKED")
                    .conviction(bSnap.bearishBias())
                    .orchestrationState(bSnap.breakdownProbability());
        }
        if (capturePct != null) {
            b.continuationCapturePct(BigDecimal.valueOf(capturePct * 100).setScale(2, RoundingMode.HALF_UP));
        }
        return b.build();
    }

    private String writeJson(Object snap) {
        try {
            return objectMapper.writeValueAsString(snap);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private static String extractNarrative(DecisionReasoningSnapshot snap) {
        if (snap instanceof EntryReasoningSnapshot e) return e.narrative();
        if (snap instanceof ExitReasoningSnapshot x) return x.narrative();
        if (snap instanceof SuppressionReasoningSnapshot s) return s.narrative();
        if (snap instanceof ReplacementReasoningSnapshot r) return r.narrative();
        if (snap instanceof BearishReasoningSnapshot b) return b.narrative();
        return "";
    }

    private boolean shouldDedupe(String key) {
        long now = System.currentTimeMillis();
        Long last = dedupeKeys.put(key, now);
        if (dedupeKeys.size() > 8000) dedupeKeys.clear();
        return last != null && now - last < 120_000;
    }

    private static boolean isRejectionState(OrchestrationState state) {
        return state == OrchestrationState.REJECTED_CORRELATION
                || state == OrchestrationState.REJECTED_QUALITY
                || state == OrchestrationState.REJECTED_MARKET;
    }

    private static String categorizeRejection(PortfolioDecision decision) {
        return switch (decision.state()) {
            case REJECTED_MARKET -> "MARKET";
            case REJECTED_QUALITY -> "QUALITY";
            case REJECTED_CORRELATION -> "CORRELATION";
            case SUPPRESSED -> "SUPPRESSED";
            case QUEUE -> "QUEUE";
            default -> decision.state().name();
        };
    }

    private static String structureLabel(MarketStructureAssessment m) {
        if (m == null) return "NEUTRAL";
        String tags = m.tags() != null && !m.tags().isEmpty()
                ? m.tags().stream().map(Enum::name).reduce((a, b) -> a + "+" + b).orElse("")
                : "";
        return m.primary().name() + (tags.isBlank() ? "" : " [" + tags + "]");
    }

    private static String vwapRelation(SymbolContext ctx) {
        if (ctx == null || ctx.getLastPrice() == null || ctx.getLiveVwap() == null) return "UNKNOWN";
        double px = ctx.getLastPrice();
        double vwap = ctx.getLiveVwap().doubleValue();
        if (px > vwap * 1.002) return "ABOVE_RECLAIM";
        if (px < vwap * 0.998) return "BELOW";
        return "AT_VWAP";
    }

    private static String emaAlignment(SymbolContext ctx) {
        if (ctx == null || ctx.getTrend() == null) return "NEUTRAL";
        return ctx.getTrend().toUpperCase(Locale.US);
    }

    private static String sectorNote(LiveTraderDtos.RankedOpportunityDto opp) {
        return opp.marketAligned() ? "ALIGNED" : "WEAK";
    }

    private static String breadthNote(MarketStructureAssessment m) {
        if (m == null) return "UNKNOWN";
        if (m.boostContinuation()) return "STRONG";
        if (m.tags().contains(com.tradingbot.marketstructure.MarketEnvironmentState.LOW_PARTICIPATION)) {
            return "WEAK";
        }
        return "MIXED";
    }

    private static int secondLegGuess(LiveTraderDtos.RankedOpportunityDto opp) {
        String lc = opp.tradeLifecycle() != null ? opp.tradeLifecycle().toUpperCase(Locale.US) : "";
        if (lc.contains("SECOND")) return 75;
        if (opp.expansionProbability() >= 60) return 55;
        return 25;
    }

    private static int exhaustionGuess(LiveTraderDtos.RankedOpportunityDto opp) {
        if (opp.degrading()) return 65;
        String lc = opp.tradeLifecycle() != null ? opp.tradeLifecycle().toUpperCase(Locale.US) : "";
        if (lc.contains("EXHAUST")) return 70;
        return 20;
    }
}
