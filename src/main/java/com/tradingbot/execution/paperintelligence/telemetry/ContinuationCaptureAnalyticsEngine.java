package com.tradingbot.execution.paperintelligence.telemetry;

import com.tradingbot.models.ExecutionTelemetryRecord;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.refinement.ContinuationCaptureEfficiency;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Locale;

@Component
public class ContinuationCaptureAnalyticsEngine {

    public ContinuationCaptureMetrics analyze(PaperExecutionRecord paper, ExecutionTelemetryRecord telemetry) {
        double capture = ContinuationCaptureEfficiency.fromPaper(paper);
        BigDecimal mfe = paper.getMfeR();
        BigDecimal realized = paper.getRealizedR();

        double exitEff = capture;
        double trailEff = telemetry != null && telemetry.getTrailingEfficiency() != null
                ? telemetry.getTrailingEfficiency().doubleValue() : capture * 0.9;

        boolean survival = Boolean.TRUE.equals(paper.getContinuationSurvival())
                || (mfe != null && mfe.compareTo(new BigDecimal("0.5")) > 0);
        boolean premature = mfe != null && realized != null
                && mfe.subtract(realized).compareTo(new BigDecimal("0.4")) > 0
                && capture < 0.45;
        boolean overstayed = realized != null && realized.compareTo(BigDecimal.ZERO) < 0
                && mfe != null && mfe.compareTo(new BigDecimal("0.3")) > 0;

        double slippagePenalty = telemetry != null && telemetry.getSlippagePct() != null
                ? Math.min(0.3, telemetry.getSlippagePct().doubleValue() / 100.0) : 0;

        int execScore = (int) Math.round(Math.max(0, Math.min(100, capture * 70 + trailEff * 20 - slippagePenalty * 100)));

        String lifecycle = telemetry != null ? telemetry.getLifecycle() : null;
        String insight = buildInsight(capture, premature, overstayed, lifecycle);

        return new ContinuationCaptureMetrics(
                capture, exitEff, trailEff, survival, premature, overstayed, slippagePenalty, execScore, insight);
    }

    private static String buildInsight(double capture, boolean premature, boolean overstayed, String lifecycle) {
        if (premature) return "Premature exit — left continuation on table";
        if (overstayed) return "Overstayed — structure invalidated before exit";
        if (capture >= 0.65) return String.format(Locale.US, "Strong capture in %s lifecycle", lifecycle);
        if (capture < 0.35) return "Weak capture — review entry/fill quality";
        return "Neutral continuation capture";
    }
}
