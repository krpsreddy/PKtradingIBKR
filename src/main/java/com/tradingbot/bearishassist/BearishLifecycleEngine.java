package com.tradingbot.bearishassist;

import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Phase 202 — maps deterioration signals to bearish lifecycle states
 * (faster / squeeze-prone; not inverted bullish lifecycle).
 */
@Component
public class BearishLifecycleEngine {

    public BearishBiasState evaluate(
            int conviction,
            int dominance,
            int persistenceSec,
            int velocity,
            int exhaustion,
            boolean vwapRejected,
            boolean failedReclaim,
            boolean degrading,
            String regime
    ) {
        if (exhaustion >= 70 && velocity > 5 && persistenceSec < 35) {
            return BearishBiasState.EXHAUSTION_BOUNCE;
        }
        if (velocity <= -12 && dominance < 60) {
            return BearishBiasState.ACCELERATED_SELLING;
        }
        if (exhaustion >= 75 && velocity <= -6) {
            return BearishBiasState.PANIC_EXPANSION;
        }
        if (failedReclaim && vwapRejected) {
            return BearishBiasState.BREAKDOWN_CONFIRMATION;
        }
        if (vwapRejected) {
            return BearishBiasState.VWAP_REJECTION;
        }
        if (failedReclaim) {
            return BearishBiasState.FAILED_RECLAIM;
        }
        if (regime != null) {
            String r = regime.toUpperCase(Locale.US);
            if (r.contains("DISTRIBUTION") || r.contains("FAIL")) {
                return BearishBiasState.DISTRIBUTION;
            }
        }
        if (degrading && persistenceSec < 45) {
            return BearishBiasState.DISTRIBUTION;
        }
        if (dominance < 80 && velocity < 0) {
            return BearishBiasState.EARLY_WEAKNESS;
        }
        return BearishBiasState.EARLY_WEAKNESS;
    }
}
