package com.tradingbot.dataintegrity;

import com.tradingbot.dataintegrity.integrity.RuntimeIntegrityState;

import java.util.List;

/** Phase 212 — point-in-time integrity assessment. */
public record DataIntegritySnapshot(
        RuntimeIntegrityState state,
        int score,
        boolean allowsExecution,
        boolean freezeRegimeMutation,
        double dominanceMultiplier,
        double convictionMultiplier,
        double persistenceMultiplier,
        int stabilizationCandlesRemaining,
        List<String> issues,
        long assessedAtMs
) {
    public static DataIntegritySnapshot disconnected() {
        return new DataIntegritySnapshot(
                RuntimeIntegrityState.DISCONNECTED, 0, false, true,
                0.5, 0.5, 0.5, 0, List.of("IBKR disconnected"),
                System.currentTimeMillis());
    }
}
