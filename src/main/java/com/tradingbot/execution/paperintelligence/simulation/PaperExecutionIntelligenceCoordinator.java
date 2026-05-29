package com.tradingbot.execution.paperintelligence.simulation;

import com.tradingbot.api.dto.PaperProbeRequest;
import com.tradingbot.config.PaperExecutionProperties;
import com.tradingbot.execution.paperintelligence.ExecutionDeteriorationState;
import com.tradingbot.execution.paperintelligence.entry.AdaptiveLimitEntryEngine;
import com.tradingbot.execution.paperintelligence.entry.EntryExecutionPlan;
import com.tradingbot.execution.paperintelligence.fills.PaperFillResult;
import com.tradingbot.execution.paperintelligence.fills.PaperFillSimulationEngine;
import com.tradingbot.execution.paperintelligence.quality.ExecutionDeteriorationEngine;
import com.tradingbot.execution.paperintelligence.quality.ExecutionQualityScoringEngine;
import com.tradingbot.execution.paperintelligence.quality.OrderTimeoutEngine;
import com.tradingbot.execution.paperintelligence.quality.StaleEntryProtectionEngine;
import com.tradingbot.execution.paperintelligence.stop.StructuralInitialStopEngine;
import com.tradingbot.execution.paperintelligence.stop.StructuralStopPlan;
import com.tradingbot.execution.paperintelligence.telemetry.ContinuationCaptureAnalyticsEngine;
import com.tradingbot.execution.paperintelligence.telemetry.ContinuationCaptureMetrics;
import com.tradingbot.execution.paperintelligence.telemetry.PaperExecutionTelemetryService;
import com.tradingbot.execution.paperintelligence.trailing.StructuralTrailingStopEngine;
import com.tradingbot.execution.paperintelligence.trailing.TrailingStopPlan;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.models.ExecutionTelemetryRecord;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.paper.PaperExecutionStatus;
import com.tradingbot.repository.ExecutionTelemetryRepository;
import com.tradingbot.repository.PaperExecutionRecordRepository;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Optional;

/** Phase 210 — orchestrates paper entry/exit intelligence (simulated execution). */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaperExecutionIntelligenceCoordinator {

    private final PaperExecutionProperties properties;
    private final AdaptiveLimitEntryEngine entryEngine;
    private final PaperFillSimulationEngine fillEngine;
    private final StructuralInitialStopEngine stopEngine;
    private final StructuralTrailingStopEngine trailingEngine;
    private final ExecutionDeteriorationEngine deteriorationEngine;
    private final StaleEntryProtectionEngine staleEntryEngine;
    private final OrderTimeoutEngine timeoutEngine;
    private final PaperExecutionTelemetryService paperTelemetry;
    private final PaperExecutionIntelligenceStateStore stateStore;
    private final ContinuationCaptureAnalyticsEngine captureAnalytics;
    private final ExecutionQualityScoringEngine qualityScoring;
    private final SymbolContextRegistry symbolContextRegistry;
    private final IBKRClientService ibkrClientService;
    private final PaperExecutionRecordRepository repository;
    private final ExecutionTelemetryRepository telemetryRepository;

    public boolean isActive() {
        return properties.isIntelligenceEnabled();
    }

    public boolean isSimulatedFillsOnly() {
        return properties.isIntelligenceEnabled() && properties.isSimulatedFillsOnly();
    }

    @Transactional
    public PaperExecutionRecord executeSimulatedEntry(
            PaperExecutionRecord record,
            LiveTraderDtos.RankedOpportunityDto opp,
            String entryReason
    ) {
        SymbolContext ctx = symbolContextRegistry.get(record.getSymbol());
        double ref = resolveReferencePrice(ctx, record);
        if (ref <= 0) {
            record.setStatus(PaperExecutionStatus.REJECTED);
            record.setBlockedReason("No reference price for simulated fill");
            return repository.save(record);
        }

        EntryExecutionPlan plan = entryEngine.plan(opp, ctx, ref);
        var stale = staleEntryEngine.evaluate(opp, plan);
        if (stale.stale()) {
            record.setStatus(PaperExecutionStatus.REJECTED);
            record.setBlockedReason("Stale entry: " + String.join("; ", stale.reasons()));
            return repository.save(record);
        }

        PaperFillResult fill = fillEngine.simulate(opp, plan, ref);
        if (!fill.filled()) {
            record.setStatus(PaperExecutionStatus.REJECTED);
            record.setBlockedReason(fill.missReason() != null ? fill.missReason() : "Limit not filled");
            return repository.save(record);
        }

        var det = deteriorationEngine.evaluate(opp, ctx, opp.convictionVelocity(),
                opp.persistenceSeconds(), opp.dominanceScore());
        StructuralStopPlan stop = stopEngine.plan(opp, ctx, fill.avgFillPrice());

        record.setLimitEntryPrice(plan.limitPrice());
        record.setEntryPrice(plan.limitPrice());
        record.setFillPrice(fill.avgFillPrice());
        record.setSlippage(fill.slippagePct());
        record.setEntryLatencyMs(fill.fillLatencyMs());
        record.setStructuralStopPrice(stop.stopPrice());
        record.setTrailingStopPrice(stop.stopPrice());
        record.setFillQuality(fill.fillQuality().name());
        record.setEntryStyle(plan.entryStyle());
        record.setSimulatedFill(true);
        record.setOrderType("SIM_LIMIT");
        record.setSubmittedAt(Instant.now());
        record.setFilledAt(Instant.now());
        record.setStatus(PaperExecutionStatus.OPEN);

        record = repository.save(record);

        TrailingStopPlan trail = trailingEngine.evaluate(
                opp.tradeLifecycle(), det.state(), fill.avgFillPrice(), stop.stopPrice(),
                fill.avgFillPrice(), opp.persistenceSeconds(), opp.convictionVelocity(), 25);
        record.setTrailingStopPrice(trail.trailingStop());
        record = repository.save(record);

        stateStore.put(new PaperExecutionIntelligenceState(
                record.getId(), plan, stop, trail, det.state(), BigDecimal.ZERO));

        paperTelemetry.captureIntelligentEntry(record, opp, entryReason, plan, fill, stop, det.state());
        log.info("Simulated paper entry {} @ {} stop {} fill {} ({})",
                record.getSymbol(), fill.avgFillPrice(), stop.stopPrice(), fill.fillQuality(), plan.entryStyle());
        return record;
    }

    public Optional<ExitDecision> evaluateOpenExit(
            PaperExecutionRecord record,
            LiveTraderDtos.RankedOpportunityDto stub,
            int liveVelocity,
            int livePersistence,
            int liveDominance
    ) {
        var stateOpt = stateStore.get(record.getId());
        if (stateOpt.isEmpty()) {
            return Optional.empty();
        }
        PaperExecutionIntelligenceState state = stateOpt.get();
        SymbolContext ctx = symbolContextRegistry.get(record.getSymbol());
        Double last = ibkrClientService.getLastPrice(record.getSymbol());
        BigDecimal px = last != null ? BigDecimal.valueOf(last)
                : (record.getFillPrice() != null ? record.getFillPrice() : BigDecimal.ZERO);

        var det = deteriorationEngine.evaluate(stub, ctx, liveVelocity, livePersistence, liveDominance);
        if (det.state().forcesExit()) {
            return Optional.of(new ExitDecision(true, "STRUCTURAL_TRAIL_COLLAPSING",
                    "Execution deterioration " + det.state(), null));
        }

        TrailingStopPlan trail = trailingEngine.evaluate(
                stub.tradeLifecycle(), det.state(), record.getFillPrice(),
                state.initialStop().stopPrice(), px,
                livePersistence, liveVelocity, 25);
        record.setTrailingStopPrice(trail.trailingStop());
        repository.save(record);

        stateStore.put(new PaperExecutionIntelligenceState(
                record.getId(), state.entryPlan(), state.initialStop(), trail, det.state(),
                peakR(record, px)));

        if (trailingEngine.stopTriggered(trail, px)) {
            return Optional.of(new ExitDecision(true, "STRUCTURAL_TRAIL_STOP",
                    trail.structuralReason(), trail));
        }
        if (det.state() == ExecutionDeteriorationState.DETERIORATING && trail.stopTightness() >= 80) {
            return Optional.of(new ExitDecision(true, "DETERIORATION_TRAIL",
                    "Deteriorating · " + trail.deteriorationAdjustment(), trail));
        }
        record.setExitSuggestion(trail.structuralReason());
        return Optional.empty();
    }

    @Transactional
    public void finalizeExit(
            PaperExecutionRecord closed,
            String exitReason,
            TrailingStopPlan trail
    ) {
        var stateOpt = stateStore.get(closed.getId());
        ExecutionDeteriorationState det = stateOpt.map(PaperExecutionIntelligenceState::deterioration)
                .orElse(ExecutionDeteriorationState.HEALTHY);
        TrailingStopPlan t = trail != null ? trail
                : stateOpt.map(PaperExecutionIntelligenceState::lastTrail).orElse(null);

        ExecutionTelemetryRecord tel = telemetryRepository.findByPaperExecutionId(closed.getId()).orElse(null);
        ContinuationCaptureMetrics capture = captureAnalytics.analyze(closed, tel);
        var quality = qualityScoring.score(closed, tel, capture);
        paperTelemetry.captureIntelligentExit(closed, exitReason, t, det, capture, quality);
        stateStore.remove(closed.getId());
    }

    private BigDecimal peakR(PaperExecutionRecord record, BigDecimal px) {
        if (record.getFillPrice() == null || record.getFillPrice().compareTo(BigDecimal.ZERO) <= 0) {
            return record.getMfeR() != null ? record.getMfeR() : BigDecimal.ZERO;
        }
        BigDecimal unreal = px.subtract(record.getFillPrice())
                .divide(record.getFillPrice(), 4, RoundingMode.HALF_UP);
        BigDecimal peak = record.getMfeR() != null ? record.getMfeR().max(unreal) : unreal;
        record.setMfeR(peak);
        return peak;
    }

    private double resolveReferencePrice(SymbolContext ctx, PaperExecutionRecord record) {
        if (record.getEntryPrice() != null && record.getEntryPrice().doubleValue() > 0) {
            return record.getEntryPrice().doubleValue();
        }
        if (ctx != null && ctx.getLastPrice() != null && ctx.getLastPrice() > 0) {
            return ctx.getLastPrice();
        }
        Double last = ibkrClientService.getLastPrice(record.getSymbol());
        return last != null ? last : 0;
    }

    public record ExitDecision(boolean shouldClose, String reasonCode, String narrative, TrailingStopPlan trail) {}
}
