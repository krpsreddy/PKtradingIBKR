package com.tradingbot.paper;

import com.tradingbot.bearish.BullishDeteriorationEngine;
import com.tradingbot.bearish.BullishDeteriorationLevel;
import com.tradingbot.bearish.BearishOperationalService;
import com.tradingbot.execution.paperintelligence.simulation.PaperExecutionIntelligenceCoordinator;
import com.tradingbot.dataintegrity.ExecutionSafetyIntegrator;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.decisiontrace.DecisionTraceService;
import com.tradingbot.decisiontrace.EntryReasoningSnapshot;
import com.tradingbot.decisiontrace.ExitReasoningSnapshot;
import com.tradingbot.decisiontrace.DecisionTraceRepository;
import com.tradingbot.exit.ExitIntelligenceAssessment;
import com.tradingbot.exit.ExitState;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.models.DecisionTraceRecord;
import com.tradingbot.exit.ExitIntelligenceEngine;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.intelligence.live.LiveScannerRollingCache;
import com.tradingbot.intelligence.live.LiveSymbolScanState;
import com.tradingbot.livetrader.execution.ExecutionTelemetryService;
import com.tradingbot.livetrader.execution.TradeLifecycleEngine;
import com.tradingbot.livetrader.execution.TradeLifecyclePhase;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.refinement.ContinuationCaptureEfficiency;
import com.tradingbot.refinement.ExecutionRefinementEngine;
import com.tradingbot.refinement.TradeRefinementAnalysis;
import com.tradingbot.repository.ExecutionTelemetryRepository;
import com.tradingbot.repository.PaperExecutionRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/** Phase 198/200 — adaptive paper exit loop (1-share research only). */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaperExecutionExitService {

    private final PaperExecutionRecordRepository repository;
    private final PaperExecutionResearchService researchService;
    private final ExitIntelligenceEngine exitEngine;
    private final TradeLifecycleEngine lifecycleEngine;
    private final LiveScannerRollingCache rollingCache;
    private final IBKRClientService ibkrClientService;
    private final ExecutionTelemetryService telemetryService;
    private final ExecutionTelemetryRepository telemetryRepository;
    private final ExecutionRefinementEngine refinementEngine;
    private final com.tradingbot.executionintelligence.ExecutionIntelligenceCoordinator intelligenceCoordinator;
    private final DecisionTraceService decisionTraceService;
    private final DecisionTraceRepository decisionTraceRepository;
    private final ObjectMapper objectMapper;
    private final ExecutionSafetyIntegrator executionSafetyIntegrator;
    private final BearishOperationalService bearishOperationalService;
    private final PaperExecutionIntelligenceCoordinator paperIntelligence;

    @Scheduled(fixedDelayString = "${paper-execution.exit-poll-ms:8000}", initialDelay = 20_000)
    @Transactional
    public void evaluateOpenExits() {
        if (executionSafetyIntegrator.blocksAdaptiveExits()) {
            return;
        }
        List<PaperExecutionRecord> open = repository.findByStatusInOrderBySubmittedAtDesc(List.of(
                PaperExecutionStatus.FILLED,
                PaperExecutionStatus.OPEN,
                PaperExecutionStatus.SUBMITTED
        ));
        for (PaperExecutionRecord record : open) {
            Double last = ibkrClientService.getLastPrice(record.getSymbol());
            LiveSymbolScanState st = rollingCache.stateFor(record.getSymbol());
            TradeLifecyclePhase phase = lifecycleEngine.evaluate(
                    st.lastConviction(),
                    st.dominanceScore(),
                    60,
                    st.convictionVelocity(),
                    50,
                    25,
                    record.getRegime(),
                    "CONFIRMED",
                    false
            );
            LiveTraderDtos.RankedOpportunityDto stub = buildStub(record, st);
            if (paperIntelligence.isActive() && Boolean.TRUE.equals(record.getSimulatedFill())) {
                var intelExit = paperIntelligence.evaluateOpenExit(
                        record, stub, st.convictionVelocity(), 60, st.dominanceScore());
                if (intelExit.isPresent() && intelExit.get().shouldClose()) {
                    BigDecimal px = last != null ? BigDecimal.valueOf(last) : null;
                    PaperExecutionRecord closed = researchService.markAdaptiveClose(
                            record.getId(), px, intelExit.get().narrative());
                    finalizeLearning(closed,
                            new ExitIntelligenceAssessment(ExitState.TRAIL, true,
                                    intelExit.get().reasonCode(), 0),
                            st.dominanceScore(), 60, st.convictionVelocity());
                    continue;
                }
            }

            BullishDeteriorationLevel deterioration = resolveDeterioration(record, st);
            if (deterioration == BullishDeteriorationLevel.COLLAPSING) {
                BigDecimal px = last != null ? BigDecimal.valueOf(last) : null;
                log.info("Bearish deterioration COLLAPSING — defensive exit {}", record.getSymbol());
                PaperExecutionRecord closed = researchService.markAdaptiveClose(
                        record.getId(), px, "BEARISH_DETERIORATION_COLLAPSING");
                finalizeLearning(closed,
                        new ExitIntelligenceAssessment(ExitState.EXIT_CRITICAL, true, "Bullish structure collapsing", 0),
                        st.dominanceScore(), 40, st.convictionVelocity());
                continue;
            }
            int persistAdj = deterioration == BullishDeteriorationLevel.DETERIORATING ? 40 : 60;
            int domAdj = deterioration.tightensExits()
                    ? Math.max(0, st.dominanceScore() - 15) : st.dominanceScore();
            ExitIntelligenceAssessment exit = exitEngine.evaluateOpenPosition(
                    record,
                    domAdj,
                    persistAdj,
                    st.convictionVelocity(),
                    deterioration == BullishDeteriorationLevel.DETERIORATING ? 1.0 : 1.5,
                    deterioration == BullishDeteriorationLevel.DETERIORATING ? 35 : 25,
                    phase.name() + (deterioration != BullishDeteriorationLevel.HEALTHY
                            ? "_" + deterioration.name() : "")
            );
            if (exit.shouldClose() || (deterioration == BullishDeteriorationLevel.DETERIORATING && deterioratingExitSignal(exit))) {
                BigDecimal px = last != null ? BigDecimal.valueOf(last) : null;
                log.info("Adaptive paper exit {} — {} ({})", record.getSymbol(), exit.state(), exit.reason());
                PaperExecutionRecord closed = researchService.markAdaptiveClose(record.getId(), px, exit.reason());
                finalizeLearning(closed, exit, st.dominanceScore(), 60, st.convictionVelocity());
            } else if (!exit.reason().isBlank()) {
                record.setExitSuggestion(exit.state() + ": " + exit.reason());
                repository.save(record);
            }
        }
    }

    private void finalizeLearning(
            PaperExecutionRecord closed,
            ExitIntelligenceAssessment exit,
            int liveDominance,
            int livePersistence,
            int liveVelocity
    ) {
        telemetryRepository.findByPaperExecutionId(closed.getId()).ifPresent(t -> {
            double eff = ContinuationCaptureEfficiency.fromPaper(closed);
            closed.setExitQualityNote(exit.state() + " · " + exit.reason() + " · capture " + String.format("%.0f%%", eff * 100));
            repository.save(closed);

            EntryReasoningSnapshot entrySnap = loadEntrySnapshot(closed.getId());
            ExitReasoningSnapshot exitSnap = decisionTraceService.traceExit(
                    closed, t, exit, liveDominance, livePersistence, liveVelocity, "FLATTENING");

            var snap = intelligenceCoordinator.snapshotFor(closed.getSymbol());
            TradeRefinementAnalysis analysis = refinementEngine.analyzeClosedTrade(
                    closed,
                    t,
                    snap != null ? snap.entryQuality().state() : null,
                    snap != null ? snap.marketStructure() : intelligenceCoordinator.currentMarketStructure(),
                    entrySnap,
                    exitSnap
            );
            log.info("Refinement {} — {}", closed.getSymbol(), analysis.learningNote());
        });
    }

    private EntryReasoningSnapshot loadEntrySnapshot(Long paperId) {
        return decisionTraceRepository
                .findFirstByPaperExecutionIdAndDecisionTypeOrderByRecordedAtDesc(paperId, "ENTRY")
                .map(DecisionTraceRecord::getSnapshotJson)
                .map(json -> {
                    try {
                        return objectMapper.readValue(json, EntryReasoningSnapshot.class);
                    } catch (Exception e) {
                        return null;
                    }
                })
                .orElse(null);
    }

    private static boolean deterioratingExitSignal(ExitIntelligenceAssessment exit) {
        return exit.state() == ExitState.REDUCE_RISK
                || exit.state() == ExitState.EXIT_WARNING
                || exit.state() == ExitState.EXIT_CRITICAL
                || exit.state() == ExitState.PERSISTENCE_FAILURE
                || exit.state() == ExitState.EXHAUSTION_EXIT;
    }

    private LiveTraderDtos.RankedOpportunityDto buildStub(PaperExecutionRecord record, LiveSymbolScanState st) {
        return new LiveTraderDtos.RankedOpportunityDto(
                record.getSymbol(),
                record.getRegime(),
                "WATCH",
                "YELLOW",
                null,
                "CONFIRMED",
                st.lastConviction(),
                st.convictionVelocity(),
                60,
                50,
                40,
                st.dominanceScore(),
                List.of(),
                null,
                "MEDIUM",
                false,
                false,
                System.currentTimeMillis(),
                "MEDIUM",
                "PERSISTING",
                "STABLE",
                1.5,
                "—",
                "—",
                "—",
                "LIVE",
                0,
                true,
                st.lastEvalMs(),
                null,
                null
        );
    }

    private BullishDeteriorationLevel resolveDeterioration(PaperExecutionRecord record, LiveSymbolScanState st) {
        return bearishOperationalService.assess(buildStub(record, st)).deterioration().level();
    }
}
