package com.tradingbot.livetrader.portfolio;

import com.tradingbot.api.dto.PaperExecutionDtos;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.MarketHeartbeatDto;
import com.tradingbot.dataintegrity.ExecutionSafetyIntegrator;
import com.tradingbot.decisiontrace.DecisionTraceService;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.paper.PaperExecutionResearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Phase 189 — portfolio orchestration facade (max 1 paper slot, queue + advisory only).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PortfolioOrchestrationService {

    private final PortfolioDecisionEngine decisionEngine;
    private final CorrelationSuppressionEngine correlationEngine;
    private final OpportunityQueueService queueService;
    private final OrchestrationTelemetryService telemetryService;
    private final PaperExecutionResearchService paperResearchService;
    private final DecisionTraceService decisionTraceService;
    private final ExecutionSafetyIntegrator executionSafetyIntegrator;

    public LiveTraderDtos.PortfolioStateDto refresh(
            LiveTraderDtos.Tier1SnapshotDto tier1,
            MarketHeartbeatDto market
    ) {
        PortfolioExposureModel exposure = buildExposure();
        boolean slotAvailable = !exposure.hasActive();
        if (!executionSafetyIntegrator.allowsExecution()) {
            return buildStateDto(exposure);
        }

        List<LiveTraderDtos.RankedOpportunityDto> ranked = tier1.topRanked() != null
                ? tier1.topRanked() : List.of();

        queueService.expireStale(ranked);

        for (int i = 0; i < ranked.size(); i++) {
            LiveTraderDtos.RankedOpportunityDto opp = ranked.get(i);
            PortfolioDecision decision = decisionEngine.evaluate(opp, exposure, market, slotAvailable);
            queueService.upsert(opp, decision);
            if (shouldPersistTelemetry(decision)) {
                telemetryService.record(opp, decision, exposure.symbol());
            }
            decisionTraceService.tracePortfolioDecision(opp, decision, exposure, i);
        }

        return buildStateDto(exposure);
    }

    /** Select at most one opportunity allowed to auto-execute this tick. */
    public Optional<LiveTraderDtos.RankedOpportunityDto> selectForExecution(
            LiveTraderDtos.Tier1SnapshotDto tier1,
            MarketHeartbeatDto market
    ) {
        if (!executionSafetyIntegrator.allowsExecution()) {
            return Optional.empty();
        }
        refresh(tier1, market);
        if (!buildExposure().hasActive() && tier1.topRanked() != null && !tier1.topRanked().isEmpty()) {
            LiveTraderDtos.RankedOpportunityDto top = tier1.topRanked().get(0);
            PortfolioDecision d = decisionEngine.evaluate(top, buildExposure(), market, true);
            if (d.eligibleForExecution() && decisionEngine.passesAutoGates(top)) {
                return Optional.of(top);
            }
        }
        return Optional.empty();
    }

    private LiveTraderDtos.PortfolioStateDto buildStateDto(PortfolioExposureModel exposure) {
        LiveTraderDtos.ActivePortfolioSlotDto activeSlot = null;
        if (exposure.hasActive()) {
            activeSlot = new LiveTraderDtos.ActivePortfolioSlotDto(
                    exposure.symbol(),
                    exposure.regime(),
                    exposure.sectorCluster(),
                    exposure.lifecycle(),
                    exposure.dominance(),
                    exposure.conviction(),
                    exposure.velocityTrend(),
                    exposure.unrealizedR(),
                    exposure.mfeR(),
                    exposure.maeR(),
                    exposure.holdDurationSec(),
                    OrchestrationState.ACTIVE.name()
            );
        }

        List<LiveTraderDtos.PortfolioOpportunitySlotDto> suppressed = new ArrayList<>();
        suppressed.addAll(mapSlots(queueService.byState(OrchestrationState.SUPPRESSED)));
        suppressed.addAll(mapSlots(queueService.byState(OrchestrationState.REJECTED_CORRELATION)));
        suppressed.addAll(mapSlots(queueService.byState(OrchestrationState.REJECTED_QUALITY)));
        suppressed.addAll(mapSlots(queueService.byState(OrchestrationState.REJECTED_MARKET)));

        return new LiveTraderDtos.PortfolioStateDto(
                activeSlot,
                mapSlots(queueService.byState(OrchestrationState.QUEUE)),
                suppressed,
                mapSlots(queueService.byState(OrchestrationState.REJECTED_CORRELATION)),
                mapSlots(queueService.byState(OrchestrationState.REJECTED_QUALITY)),
                mapSlots(queueService.byState(OrchestrationState.REJECTED_MARKET)),
                mapSlots(queueService.byState(OrchestrationState.REPLACEMENT_CANDIDATE)),
                1,
                queueService.byState(OrchestrationState.QUEUE).size(),
                System.currentTimeMillis()
        );
    }

    private static boolean shouldPersistTelemetry(PortfolioDecision decision) {
        return decision.eligibleForExecution()
                || decision.replacementAdvisory()
                || decision.state() == OrchestrationState.QUEUE
                || decision.state() == OrchestrationState.REJECTED_CORRELATION
                || decision.state() == OrchestrationState.REJECTED_QUALITY
                || decision.state() == OrchestrationState.REJECTED_MARKET;
    }

    private List<LiveTraderDtos.PortfolioOpportunitySlotDto> mapSlots(List<QueuedOpportunity> items) {
        List<LiveTraderDtos.PortfolioOpportunitySlotDto> out = new ArrayList<>();
        for (QueuedOpportunity q : items) {
            out.add(new LiveTraderDtos.PortfolioOpportunitySlotDto(
                    q.symbol(),
                    q.regime(),
                    q.state().name(),
                    q.reason(),
                    q.dominance(),
                    q.conviction(),
                    q.persistence(),
                    q.executionQuality(),
                    q.tradeLifecycle(),
                    q.queuedAt() != null ? q.queuedAt().toEpochMilli() : 0
            ));
        }
        return out;
    }

    private PortfolioExposureModel buildExposure() {
        List<PaperExecutionRecord> active = paperResearchService.activeRecords();
        if (active.isEmpty()) {
            return PortfolioExposureModel.empty();
        }
        PaperExecutionRecord r = active.get(0);
        PaperExecutionDtos.PaperExecutionRecordDto dto = PaperExecutionDtos.toDto(r);
        Integer holdSec = null;
        if (r.getSubmittedAt() != null) {
            holdSec = (int) Duration.between(r.getSubmittedAt(), Instant.now()).getSeconds();
        }
        return new PortfolioExposureModel(
                true,
                r.getSymbol(),
                r.getRegime(),
                correlationEngine.clusterFor(r.getSymbol()),
                r.getDominanceScore() != null ? r.getDominanceScore() : 0,
                r.getConvictionScore() != null ? r.getConvictionScore() : 0,
                "PERSISTING",
                "FLATTENING",
                dto.getMfeR(),
                dto.getMfeR(),
                dto.getMaeR(),
                holdSec,
                r.getSubmittedAt(),
                r.getId()
        );
    }
}
