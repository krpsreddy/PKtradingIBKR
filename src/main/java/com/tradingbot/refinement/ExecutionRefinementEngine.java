package com.tradingbot.refinement;

import com.tradingbot.decisiontrace.EntryReasoningSnapshot;
import com.tradingbot.decisiontrace.ExitReasoningSnapshot;
import com.tradingbot.entry.EntryQualityState;
import com.tradingbot.marketstructure.MarketEnvironmentState;
import com.tradingbot.marketstructure.MarketStructureAssessment;
import com.tradingbot.execution.paperintelligence.telemetry.ContinuationCaptureAnalyticsEngine;
import com.tradingbot.models.ExecutionTelemetryRecord;
import com.tradingbot.models.PaperExecutionRecord;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * Phase 200 — post-trade learning loop for telemetry quality notes.
 */
@Component
public class ExecutionRefinementEngine {

    private final ContinuationCaptureAnalyticsEngine captureAnalytics;

    public ExecutionRefinementEngine(ContinuationCaptureAnalyticsEngine captureAnalytics) {
        this.captureAnalytics = captureAnalytics;
    }

    public TradeRefinementAnalysis analyzeClosedTrade(
            PaperExecutionRecord paper,
            ExecutionTelemetryRecord telemetry,
            EntryQualityState entryQuality,
            MarketStructureAssessment marketAtEntry
    ) {
        return analyzeClosedTrade(paper, telemetry, entryQuality, marketAtEntry, null, null);
    }

    /** Phase 201 — refinement uses decision reasoning snapshots when available. */
    public TradeRefinementAnalysis analyzeClosedTrade(
            PaperExecutionRecord paper,
            ExecutionTelemetryRecord telemetry,
            EntryQualityState entryQuality,
            MarketStructureAssessment marketAtEntry,
            EntryReasoningSnapshot entryReasoning,
            ExitReasoningSnapshot exitReasoning
    ) {
        double eff = ContinuationCaptureEfficiency.fromPaper(paper);
        if (telemetry != null && telemetry.getContinuationCapturePct() != null) {
            eff = telemetry.getContinuationCapturePct().doubleValue() / 100.0;
        } else if (exitReasoning != null && exitReasoning.continuationCapturePct() != null) {
            eff = exitReasoning.continuationCapturePct() / 100.0;
        }
        EntryQualityState eq = entryQuality;
        if (entryReasoning != null && entryReasoning.entryQuality() != null) {
            try {
                eq = EntryQualityState.valueOf(entryReasoning.entryQuality());
            } catch (Exception ignored) {
                // keep passed entryQuality
            }
        }

        boolean idealEntry = eq == EntryQualityState.IDEAL
                || eq == EntryQualityState.CONFIRMED
                || eq == EntryQualityState.EARLY;

        boolean exitPremature = paper.getMfeR() != null
                && paper.getRealizedR() != null
                && paper.getMfeR().subtract(paper.getRealizedR()).compareTo(new BigDecimal("0.4")) > 0
                && eff < 0.45;
        if (exitReasoning != null && exitReasoning.exitState() != null
                && exitReasoning.exitState().contains("WARNING") && eff < 0.5) {
            exitPremature = true;
        }

        boolean secondLeg = Boolean.TRUE.equals(paper.getSecondLegCaptured())
                || Boolean.TRUE.equals(paper.getContinuationSurvival())
                || (exitReasoning != null && exitReasoning.secondLegProbability() >= 50);

        boolean structureOk = marketAtEntry == null
                || !marketAtEntry.tags().contains(MarketEnvironmentState.CHOP);
        if (entryReasoning != null && entryReasoning.marketStructure() != null
                && entryReasoning.marketStructure().contains("CHOP")) {
            structureOk = false;
        }

        boolean persistenceOk = paper.getPersistenceDurationSec() == null
                || paper.getPersistenceDurationSec() >= 45;
        if (exitReasoning != null && exitReasoning.persistenceAtEntry() >= 60
                && exitReasoning.continuationDeterioration() > 25) {
            persistenceOk = false;
        }

        String entryNote = entryReasoning != null ? entryReasoning.narrative() : (eq != null ? eq.name() : "?");
        String exitNote = exitReasoning != null ? exitReasoning.narrative()
                : (paper.getExitQualityNote() != null ? paper.getExitQualityNote() : "—");

        String summary = String.format(Locale.US,
                "Capture %.0f%% · entry %s · exit %s",
                eff * 100,
                entryNote.length() > 80 ? (eq != null ? eq.name() : "?") : entryNote,
                exitNote.length() > 120 ? paper.getExitQualityNote() : exitNote);

        String learning = buildLearningNote(eff, exitPremature, idealEntry, structureOk);
        if (exitReasoning != null && exitReasoning.vwapFailure() && eff < 0.4) {
            learning = "VWAP failure exit — tighten trail when acceptance lost";
        } else if (entryReasoning != null && entryReasoning.entryQuality() != null
                && entryReasoning.entryQuality().equals(EntryQualityState.CHASING.name())) {
            learning = "Chasing entry detected — block similar auto entries";
        }
        var captureMetrics = captureAnalytics.analyze(paper, telemetry);
        if (captureMetrics.prematureExit() && "Neutral learning tick".equals(learning)) {
            learning = captureMetrics.insight();
        }
        if (Boolean.TRUE.equals(telemetry != null ? telemetry.getPrematureExit() : null)) {
            exitPremature = true;
        }

        return new TradeRefinementAnalysis(
                eff, idealEntry, exitPremature, secondLeg, structureOk, persistenceOk, summary, learning);
    }

    private static String buildLearningNote(
            double eff,
            boolean exitPremature,
            boolean idealEntry,
            boolean structureOk
    ) {
        if (exitPremature && eff < 0.4) {
            return "Exit too early — widen trail on similar setups";
        }
        if (!idealEntry && eff < 0.3) {
            return "Mediocre entry — tighten auto gates";
        }
        if (!structureOk && eff < 0.35) {
            return "Chop/low participation — suppress continuation regimes";
        }
        if (eff >= 0.65 && idealEntry) {
            return "High capture — reinforce ranking for this pattern";
        }
        return "Neutral learning tick";
    }
}
