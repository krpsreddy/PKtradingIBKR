package com.tradingbot.execution.paperintelligence.quality;

import com.tradingbot.execution.paperintelligence.ExecutionQualityGrade;
import com.tradingbot.execution.paperintelligence.FillQuality;
import com.tradingbot.execution.paperintelligence.telemetry.ContinuationCaptureMetrics;
import com.tradingbot.models.ExecutionTelemetryRecord;
import com.tradingbot.models.PaperExecutionRecord;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class ExecutionQualityScoringEngine {

    public ExecutionQualityScore score(
            PaperExecutionRecord paper,
            ExecutionTelemetryRecord telemetry,
            ContinuationCaptureMetrics capture
    ) {
        ExecutionQualityGrade entry = gradeEntry(telemetry);
        ExecutionQualityGrade fill = gradeFill(telemetry);
        ExecutionQualityGrade trail = gradeTrail(telemetry);
        ExecutionQualityGrade exit = gradeExit(capture);
        ExecutionQualityGrade cont = gradeCapture(capture);

        int composite = (gradeOrdinal(entry) + gradeOrdinal(fill) + gradeOrdinal(trail)
                + gradeOrdinal(exit) + gradeOrdinal(cont)) * 4;

        String summary = String.format("Entry %s · Fill %s · Trail %s · Exit %s · Capture %s · score %d",
                entry, fill, trail, exit, cont, composite);

        return new ExecutionQualityScore(entry, fill, trail, exit, cont, composite, summary);
    }

    private static ExecutionQualityGrade gradeEntry(ExecutionTelemetryRecord t) {
        if (t == null) return ExecutionQualityGrade.WEAK;
        Integer prob = t.getFillProbability();
        if (prob != null && prob >= 80) return ExecutionQualityGrade.ELITE;
        if (prob != null && prob >= 65) return ExecutionQualityGrade.STRONG;
        return ExecutionQualityGrade.ACCEPTABLE;
    }

    private static ExecutionQualityGrade gradeFill(ExecutionTelemetryRecord t) {
        if (t == null || t.getFillQuality() == null) return ExecutionQualityGrade.WEAK;
        try {
        return switch (FillQuality.valueOf(t.getFillQuality())) {
            case EXCELLENT -> ExecutionQualityGrade.ELITE;
            case GOOD -> ExecutionQualityGrade.STRONG;
            case FAIR -> ExecutionQualityGrade.ACCEPTABLE;
            case POOR -> ExecutionQualityGrade.WEAK;
            case MISSED -> ExecutionQualityGrade.POOR;
        };
        } catch (Exception e) {
            return ExecutionQualityGrade.ACCEPTABLE;
        }
    }

    private static ExecutionQualityGrade gradeTrail(ExecutionTelemetryRecord t) {
        if (t == null || t.getTrailingEfficiency() == null) return ExecutionQualityGrade.ACCEPTABLE;
        double e = t.getTrailingEfficiency().doubleValue();
        if (e >= 0.75) return ExecutionQualityGrade.ELITE;
        if (e >= 0.55) return ExecutionQualityGrade.STRONG;
        if (e >= 0.35) return ExecutionQualityGrade.ACCEPTABLE;
        return ExecutionQualityGrade.WEAK;
    }

    private static ExecutionQualityGrade gradeExit(ContinuationCaptureMetrics c) {
        if (c.prematureExit()) return ExecutionQualityGrade.WEAK;
        if (c.overstayed()) return ExecutionQualityGrade.ACCEPTABLE;
        if (c.captureRatio() >= 0.65) return ExecutionQualityGrade.ELITE;
        if (c.captureRatio() >= 0.45) return ExecutionQualityGrade.STRONG;
        return ExecutionQualityGrade.ACCEPTABLE;
    }

    private static ExecutionQualityGrade gradeCapture(ContinuationCaptureMetrics c) {
        if (c.captureRatio() >= 0.7) return ExecutionQualityGrade.ELITE;
        if (c.captureRatio() >= 0.5) return ExecutionQualityGrade.STRONG;
        if (c.captureRatio() >= 0.3) return ExecutionQualityGrade.ACCEPTABLE;
        return ExecutionQualityGrade.WEAK;
    }

    private static int gradeOrdinal(ExecutionQualityGrade g) {
        return switch (g) {
            case ELITE -> 5;
            case STRONG -> 4;
            case ACCEPTABLE -> 3;
            case WEAK -> 2;
            case POOR -> 1;
        };
    }
}
