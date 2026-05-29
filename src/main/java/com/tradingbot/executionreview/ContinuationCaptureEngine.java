package com.tradingbot.executionreview;

import com.tradingbot.executionreview.ExecutionReviewDtos.ContinuationCaptureDto;
import com.tradingbot.models.ExecutionTelemetryRecord;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Phase 190 — continuation monetization metrics. */
@Component
public class ContinuationCaptureEngine {

    public ContinuationCaptureDto analyze(ExecutionTelemetryRecord t) {
        BigDecimal mfe = t.getMfeR() != null ? t.getMfeR() : BigDecimal.ZERO;
        BigDecimal realized = t.getRealizedR() != null ? t.getRealizedR() : BigDecimal.ZERO;
        double mfeVal = mfe.doubleValue();
        double rVal = realized.doubleValue();

        double capturePct = pct(rVal, mfeVal);
        double mfeCapture = capturePct;
        double secondLeg = secondLegCapture(t, mfeVal, rVal);
        double persistenceMon = persistenceMonetization(t);
        double trailEff = trailEfficiency(t, mfeVal, rVal);

        return new ContinuationCaptureDto(
                t.getId(),
                t.getSymbol(),
                mfe,
                realized,
                round(capturePct),
                round(mfeCapture),
                round(secondLeg),
                round(persistenceMon),
                round(trailEff)
        );
    }

    public double aggregateCapturePct(java.util.List<ExecutionTelemetryRecord> closed) {
        if (closed.isEmpty()) return 0;
        double sum = 0;
        int n = 0;
        for (ExecutionTelemetryRecord t : closed) {
            double c = ExitQualityReviewEngine.captureRatio(t);
            if (t.getMfeR() != null && t.getMfeR().doubleValue() > 0.05) {
                sum += Math.min(1.0, Math.max(0, c));
                n++;
            }
        }
        return n == 0 ? 0 : round((sum / n) * 100);
    }

    private static double secondLegCapture(ExecutionTelemetryRecord t, double mfe, double realized) {
        String lc = t.getLifecycle() != null ? t.getLifecycle().toUpperCase() : "";
        if ("SECOND_LEG".equals(lc) || "EXTENDED".equals(lc)) {
            return pct(realized, mfe);
        }
        if (mfe >= 1.0 && realized >= 0.5) {
            return 72;
        }
        if (mfe >= 0.8) {
            return pct(realized, mfe) * 0.85;
        }
        return pct(realized, mfe) * 0.5;
    }

    private static double persistenceMonetization(ExecutionTelemetryRecord t) {
        int persist = t.getPersistence() != null ? t.getPersistence() : 0;
        double cap = ExitQualityReviewEngine.captureRatio(t) * 100;
        if (persist >= 120) return Math.min(100, cap * 1.1);
        if (persist >= 60) return cap;
        return cap * 0.75;
    }

    private static double trailEfficiency(ExecutionTelemetryRecord t, double mfe, double realized) {
        if (mfe <= 0) return 0;
        BigDecimal mae = t.getMaeR();
        double maeAbs = mae != null ? Math.abs(mae.doubleValue()) : 0;
        double giveback = Math.max(0, mfe - realized);
        double eff = (realized / mfe) * (1.0 - Math.min(0.5, giveback / (mfe + 0.01)));
        if (maeAbs > 0.4 && realized > 0) eff *= 0.9;
        return Math.min(100, Math.max(0, eff * 100));
    }

    private static double pct(double num, double den) {
        if (den <= 0.05) return num > 0 ? 100 : 0;
        return Math.min(100, Math.max(0, (num / den) * 100));
    }

    private static double round(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }
}
