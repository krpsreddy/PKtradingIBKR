package com.tradingbot.livetrader.execution;

import org.springframework.stereotype.Component;

/**
 * Phase 188 — lightweight execution quality from live scores (no analytics DB).
 */
@Component
public class ExecutionQualityEngine {

    public ExecutionQuality evaluate(
            int conviction,
            int dominance,
            int persistence,
            double rvol,
            int velocity,
            int expansion,
            int institutional,
            int exhaustion,
            String regime,
            String maturityState
    ) {
        if (isBlocked(regime, maturityState, exhaustion)) {
            return ExecutionQuality.LOW;
        }
        int score = conviction / 4
                + dominance / 8
                + persistence / 6
                + (rvol >= 2.5 ? 12 : rvol >= 1.5 ? 8 : rvol >= 1.0 ? 3 : 0)
                + (velocity > 8 ? 8 : velocity > 0 ? 4 : velocity < -5 ? -6 : 0)
                + expansion / 8
                + institutional / 10
                - exhaustion / 6;

        if (score >= 52
                && conviction >= 78
                && dominance >= 110
                && persistence >= 65
                && rvol >= 2.0
                && institutional >= 60) {
            return ExecutionQuality.INSTITUTIONAL;
        }
        if (score >= 38 && conviction >= 65 && dominance >= 85 && persistence >= 50) {
            return ExecutionQuality.HIGH;
        }
        if (score >= 22 && conviction >= 50) {
            return ExecutionQuality.MEDIUM;
        }
        return ExecutionQuality.LOW;
    }

    private static boolean isBlocked(String regime, String maturity, int exhaustion) {
        if (exhaustion >= 60) return true;
        if (maturity != null && (maturity.contains("FAILED") || maturity.contains("EXHAUST"))) return true;
        if (regime == null) return false;
        String r = regime.toUpperCase();
        return r.contains("EXHAUSTION") || r.contains("FAILED") || r.contains("CHOP");
    }
}
