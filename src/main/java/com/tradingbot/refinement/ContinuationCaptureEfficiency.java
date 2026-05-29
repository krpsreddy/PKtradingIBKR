package com.tradingbot.refinement;

import com.tradingbot.models.ExecutionTelemetryRecord;
import com.tradingbot.models.PaperExecutionRecord;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Phase 200 — captured move / available move (not PnL alone).
 */
public final class ContinuationCaptureEfficiency {

    private ContinuationCaptureEfficiency() {}

    public static double compute(BigDecimal realizedR, BigDecimal mfeR) {
        if (mfeR == null || mfeR.compareTo(BigDecimal.ZERO) <= 0) {
            return realizedR != null && realizedR.compareTo(BigDecimal.ZERO) > 0 ? 1.0 : 0;
        }
        if (realizedR == null) return 0;
        double eff = realizedR.divide(mfeR, 4, RoundingMode.HALF_UP).doubleValue();
        return Math.max(0, Math.min(1.5, eff));
    }

    public static double fromTelemetry(ExecutionTelemetryRecord t) {
        return compute(t.getRealizedR(), t.getMfeR());
    }

    public static double fromPaper(PaperExecutionRecord r) {
        return compute(r.getRealizedR(), r.getMfeR());
    }
}
