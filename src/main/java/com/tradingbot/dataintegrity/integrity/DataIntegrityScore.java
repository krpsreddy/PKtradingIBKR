package com.tradingbot.dataintegrity.integrity;

import com.tradingbot.dataintegrity.continuity.CandleContinuityValidator;
import com.tradingbot.dataintegrity.staleness.StaleDataDetector;

/** Phase 212 — composite integrity score (0–100). */
public final class DataIntegrityScore {

    private DataIntegrityScore() {}

    public record Components(
            int freshness,
            int continuity,
            int reconnectStability,
            int tickCadence,
            int candleCompleteness
    ) {}

    public static int compute(
            RuntimeIntegrityState state,
            StaleDataDetector.StaleResult stale,
            CandleContinuityValidator.ContinuityResult continuity,
            int stabilizationRemaining
    ) {
        Components c = components(state, stale, continuity, stabilizationRemaining);
        return Math.max(0, Math.min(100,
                (c.freshness() + c.continuity() + c.reconnectStability()
                        + c.tickCadence() + c.candleCompleteness()) / 5));
    }

    public static Components components(
            RuntimeIntegrityState state,
            StaleDataDetector.StaleResult stale,
            CandleContinuityValidator.ContinuityResult continuity,
            int stabilizationRemaining
    ) {
        int reconnect = switch (state) {
            case LIVE, DELAYED -> 92;
            case RECOVERING -> Math.max(35, 70 - stabilizationRemaining * 15);
            case DEGRADED -> 55;
            case STALE -> 40;
            case DISCONNECTED -> 10;
        };
        int tickCadence = stale.freshnessScore();
        int completeness = continuity.continuityScore();
        return new Components(
                stale.freshnessScore(),
                continuity.continuityScore(),
                reconnect,
                tickCadence,
                completeness
        );
    }
}
