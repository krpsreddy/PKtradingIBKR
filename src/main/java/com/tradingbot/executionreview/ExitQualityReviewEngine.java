package com.tradingbot.executionreview;

import com.tradingbot.models.ExecutionTelemetryRecord;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Phase 190 — classify exit timing vs available move. */
@Component
public class ExitQualityReviewEngine {

    public String classify(ExecutionTelemetryRecord t) {
        if (t.getClosedAt() == null) {
            return "OPEN";
        }
        BigDecimal realized = t.getRealizedR();
        BigDecimal mfe = t.getMfeR();
        BigDecimal mae = t.getMaeR();
        String lifecycle = t.getLifecycle() != null ? t.getLifecycle().toUpperCase() : "";

        double r = realized != null ? realized.doubleValue() : 0;
        double mfeVal = mfe != null ? mfe.doubleValue() : 0;
        double maeVal = mae != null ? Math.abs(mae.doubleValue()) : 0;
        double capture = mfeVal > 0.05 ? r / mfeVal : (r > 0 ? 1.0 : 0);

        if (r < -0.15 && maeVal > 0.5) {
            return "HELD_THROUGH_FAILURE";
        }
        if (mfeVal >= 1.2 && r < 0.35) {
            return "MISSED_SECOND_LEG";
        }
        if (r > 0 && ("PERSISTING".equals(lifecycle) || "SECOND_LEG".equals(lifecycle)) && capture < 0.55) {
            return "EXITED_INTO_STRENGTH";
        }
        if (r > 0 && capture >= 0.5) {
            return "OPTIMAL";
        }
        if (r > 0 && capture < 0.4) {
            return "PREMATURE";
        }
        Integer hold = t.getHoldDurationSec();
        if (r <= 0 && hold != null && hold > 3600) {
            return "HELD_TOO_LONG";
        }
        if (r <= 0 && mfeVal > 0.3) {
            return "HELD_TOO_LONG";
        }
        return r >= 0 ? "OPTIMAL" : "HELD_THROUGH_FAILURE";
    }

    public static double captureRatio(ExecutionTelemetryRecord t) {
        BigDecimal mfe = t.getMfeR();
        BigDecimal realized = t.getRealizedR();
        if (mfe == null || realized == null || mfe.compareTo(BigDecimal.valueOf(0.05)) <= 0) {
            return realized != null && realized.compareTo(BigDecimal.ZERO) > 0 ? 1.0 : 0;
        }
        return realized.divide(mfe, 4, RoundingMode.HALF_UP).doubleValue();
    }
}
