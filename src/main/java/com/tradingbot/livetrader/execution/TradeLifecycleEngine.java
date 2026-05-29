package com.tradingbot.livetrader.execution;

import org.springframework.stereotype.Component;

/**
 * Phase 188 — trade lifecycle progression from live conviction / persistence / regime.
 */
@Component
public class TradeLifecycleEngine {

    public TradeLifecyclePhase evaluate(
            int conviction,
            int dominance,
            int persistence,
            int velocity,
            int expansion,
            int exhaustion,
            String regime,
            String maturityState,
            boolean secondLegActive
    ) {
        if (isFailed(regime, maturityState, exhaustion)) {
            return TradeLifecyclePhase.FAILED;
        }
        if (exhaustion >= 58 || (maturityState != null && maturityState.contains("EXHAUST"))) {
            return TradeLifecyclePhase.EXHAUSTING;
        }
        if (secondLegActive || (regime != null && regime.toUpperCase().contains("COMPRESSION"))) {
            if (conviction >= 70 && persistence >= 55) {
                return TradeLifecyclePhase.SECOND_LEG;
            }
        }
        if (conviction >= 82 && persistence >= 70 && dominance >= 100) {
            return TradeLifecyclePhase.EXTENDED;
        }
        if (conviction >= 68 && persistence >= 58 && velocity >= 0) {
            return TradeLifecyclePhase.PERSISTING;
        }
        if (conviction >= 55 && (maturityState == null || maturityState.contains("CONFIRM"))) {
            return TradeLifecyclePhase.CONFIRMED;
        }
        return TradeLifecyclePhase.DEVELOPING;
    }

    public String velocityTrend(int velocity) {
        if (velocity >= 6) return "ACCELERATING";
        if (velocity <= -4) return "DECAYING";
        return "FLATTENING";
    }

    private static boolean isFailed(String regime, String maturity, int exhaustion) {
        if (maturity != null && maturity.contains("FAILED")) return true;
        if (regime != null && regime.toUpperCase().contains("FAILED")) return true;
        return exhaustion >= 72 && (maturity == null || !maturity.contains("CONFIRM"));
    }
}
