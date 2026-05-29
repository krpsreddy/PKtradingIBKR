package com.tradingbot.execution.paperintelligence.telemetry;

import com.tradingbot.execution.paperintelligence.ExecutionDeteriorationState;
import com.tradingbot.execution.paperintelligence.entry.EntryExecutionPlan;
import com.tradingbot.execution.paperintelligence.fills.PaperFillResult;
import com.tradingbot.execution.paperintelligence.quality.ExecutionQualityScore;
import com.tradingbot.execution.paperintelligence.stop.StructuralStopPlan;
import com.tradingbot.execution.paperintelligence.trailing.TrailingStopPlan;
import com.tradingbot.intelligence.live.MarketSessionClock;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.models.ExecutionTelemetryRecord;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.repository.ExecutionTelemetryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class PaperExecutionTelemetryService {

    private final ExecutionTelemetryRepository repository;
    private final MarketSessionClock sessionClock;

    @Transactional
    public ExecutionTelemetryRecord captureIntelligentEntry(
            PaperExecutionRecord paper,
            LiveTraderDtos.RankedOpportunityDto opp,
            String entryReason,
            EntryExecutionPlan plan,
            PaperFillResult fill,
            StructuralStopPlan stop,
            ExecutionDeteriorationState deterioration
    ) {
        String conflict = opp.bearishOps() != null ? opp.bearishOps().directionalConflict() : "NONE";
        String suppression = opp.bearishOps() != null ? opp.bearishOps().longSuppression() : "NONE";

        ExecutionTelemetryRecord t = ExecutionTelemetryRecord.builder()
                .paperExecutionId(paper.getId())
                .symbol(paper.getSymbol())
                .regime(paper.getRegime())
                .openedAt(Instant.now())
                .conviction(opp.conviction())
                .dominance(opp.dominanceScore())
                .persistence(opp.persistenceSeconds())
                .rvol(BigDecimal.valueOf(opp.rvol()).setScale(3, RoundingMode.HALF_UP))
                .velocity(opp.convictionVelocity())
                .lifecycle(opp.tradeLifecycle())
                .executionQuality(opp.executionQuality())
                .entryReason(entryReason)
                .entryPrice(fill.avgFillPrice())
                .stopPrice(stop.stopPrice())
                .targetPrice(parsePrice(opp.targetLabel()))
                .marketRegime(opp.regime())
                .sessionPeriod(sessionClock.windowLabel(sessionClock.sessionMinutesSinceRthOpen()))
                .entryOffsetPct(plan.entryOffset())
                .fillProbability(plan.fillProbability())
                .slippagePct(fill.slippagePct())
                .fillLatencyMs(fill.fillLatencyMs())
                .fillQuality(fill.fillQuality().name())
                .spreadEstimate(BigDecimal.valueOf(0.08))
                .directionalConflict(conflict)
                .longSuppression(suppression)
                .deteriorationState(deterioration.name())
                .entryStyle(plan.entryStyle())
                .build();
        return repository.save(t);
    }

    @Transactional
    public void captureIntelligentExit(
            PaperExecutionRecord paper,
            String exitReason,
            TrailingStopPlan trail,
            ExecutionDeteriorationState deterioration,
            ContinuationCaptureMetrics capture,
            ExecutionQualityScore quality
    ) {
        repository.findByPaperExecutionId(paper.getId()).ifPresent(t -> {
            t.setClosedAt(paper.getClosedAt() != null ? paper.getClosedAt() : Instant.now());
            t.setExitReason(exitReason);
            t.setRealizedR(paper.getRealizedR());
            t.setMfeR(paper.getMfeR());
            t.setMaeR(paper.getMaeR());
            t.setTrailingState(trail != null ? trail.structuralReason() : null);
            t.setDeteriorationState(deterioration.name());
            t.setUnrealizedPeakR(paper.getMfeR());
            t.setTrailingEfficiency(BigDecimal.valueOf(capture.trailingEfficiency()).setScale(4, RoundingMode.HALF_UP));
            t.setContinuationCapturePct(BigDecimal.valueOf(capture.captureRatio() * 100).setScale(2, RoundingMode.HALF_UP));
            t.setPrematureExit(capture.prematureExit());
            t.setOverstayedTrade(capture.overstayed());
            t.setSlippagePenalty(BigDecimal.valueOf(capture.slippagePenalty()).setScale(4, RoundingMode.HALF_UP));
            t.setExecutionScore(capture.executionScore());
            if (quality != null) {
                t.setExecutionGrade(quality.continuationCapture().name());
                t.setEntryQualityGrade(quality.entryQuality().name());
                t.setFillQualityGrade(quality.fillQuality().name());
                t.setExitQualityGrade(quality.exitQuality().name());
            }
            if (t.getOpenedAt() != null && t.getClosedAt() != null) {
                t.setHoldDurationSec((int) Duration.between(t.getOpenedAt(), t.getClosedAt()).getSeconds());
            }
            repository.save(t);
        });
    }

    private static BigDecimal parsePrice(String label) {
        if (label == null || label.isBlank() || label.equals("—")) return null;
        try {
            String n = label.replaceAll("[^0-9.]", "");
            if (n.isBlank()) return null;
            return new BigDecimal(n);
        } catch (Exception e) {
            return null;
        }
    }
}
