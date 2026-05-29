package com.tradingbot.executionreview;

import com.tradingbot.models.ExecutionTelemetryRecord;
import org.springframework.stereotype.Component;

/** Phase 190 — human-readable execution story. */
@Component
public class ExecutionNarrativeEngine {

    private final EntryQualityReviewEngine entryQuality;
    private final ExitQualityReviewEngine exitQuality;
    private final ContinuationCaptureEngine continuation;

    public ExecutionNarrativeEngine(
            EntryQualityReviewEngine entryQuality,
            ExitQualityReviewEngine exitQuality,
            ContinuationCaptureEngine continuation
    ) {
        this.entryQuality = entryQuality;
        this.exitQuality = exitQuality;
        this.continuation = continuation;
    }

    public String build(ExecutionTelemetryRecord t) {
        String entryQ = entryQuality.classify(t);
        String exitQ = exitQuality.classify(t);
        String regime = label(t.getRegime());
        String lifecycle = label(t.getLifecycle());
        double cap = continuation.analyze(t).capturePct();

        StringBuilder sb = new StringBuilder();
        sb.append("Entered during ").append(entryQ.toLowerCase().replace('_', ' '))
                .append(" ").append(regime).append(" setup");
        if (lifecycle != null && !lifecycle.isBlank()) {
            sb.append(" (lifecycle ").append(lifecycle).append(")");
        }
        sb.append(". ");

        if (t.getClosedAt() == null) {
            sb.append("Position still open — continuation capture not finalized.");
            return sb.toString();
        }

        sb.append("Exit classified as ").append(exitQ.toLowerCase().replace('_', ' '));
        if (t.getExitReason() != null && !t.getExitReason().isBlank()) {
            sb.append(" (").append(t.getExitReason()).append(")");
        }
        sb.append(". Captured ").append(String.format("%.0f", cap))
                .append("% of available continuation");
        if (t.getRealizedR() != null) {
            sb.append(" (").append(formatR(t.getRealizedR().doubleValue())).append(" realized)");
        }
        sb.append(".");

        return sb.toString();
    }

    private static String label(String raw) {
        if (raw == null || raw.isBlank()) return "";
        return raw.toLowerCase().replace('_', ' ');
    }

    private static String formatR(double r) {
        return (r >= 0 ? "+" : "") + String.format("%.2f", r) + "R";
    }
}
