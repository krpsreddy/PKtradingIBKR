package com.tradingbot.intelligence.execution.realtime;

import com.tradingbot.symbol.SymbolContext;

/** Stage 2 — 5–15s micro persistence validation. */
public final class MicroPersistenceValidator {

    private static final int MIN_PERSISTENCE_SEC = 5;

    private MicroPersistenceValidator() {}

    public record PersistenceResult(boolean passed, int persistenceSeconds, int persistenceBoost) {}

    public static PersistenceResult validate(
            NanoAnomalyDetector.NanoAnomalyResult anomaly,
            SymbolTickState tick,
            long nowMs
    ) {
        if (!anomaly.anomalyDetected()) {
            return new PersistenceResult(false, 0, 0);
        }
        long typeHash = anomaly.opportunityType().hashCode();
        long since = tick.anomalySinceMs();
        if (since == 0 || tick.lastAnomalyTypeHash() != typeHash) {
            since = nowMs;
        }
        int seconds = (int) ((nowMs - since) / 1000L);
        int boost = Math.min(25, seconds * 3);
        boolean passed = seconds >= MIN_PERSISTENCE_SEC;
        return new PersistenceResult(passed, seconds, boost);
    }

    public static int structuralBoost(SymbolContext ctx) {
        int boost = 0;
        if (ctx.getLatestIndicators() != null) boost += 8;
        if ("CONT_READY".equals(ctx.getReadinessState()) || "OPEN_READY".equals(ctx.getReadinessState())) boost += 12;
        if (ctx.hasValidCache() && ctx.getCachedCandles().size() >= 3) boost += 6;
        return boost;
    }
}
