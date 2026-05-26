package com.tradingbot.intelligence.execution.realtime;

/** Rolling per-symbol tick metrics for velocity and persistence. */
public record SymbolTickState(
        String symbol,
        double lastRvol,
        int lastConviction,
        long anomalySinceMs,
        long lastAnomalyTypeHash,
        int persistenceSeconds,
        int convictionVelocity,
        long lastUpdateMs
) {
    public static SymbolTickState initial(String symbol) {
        return new SymbolTickState(symbol, 0, 0, 0, 0, 0, 0, 0);
    }

    public SymbolTickState withRvol(double rvol) {
        return new SymbolTickState(symbol, rvol, lastConviction, anomalySinceMs, lastAnomalyTypeHash,
                persistenceSeconds, convictionVelocity, System.currentTimeMillis());
    }

    public SymbolTickState withConviction(int conviction, int velocity) {
        return new SymbolTickState(symbol, lastRvol, conviction, anomalySinceMs, lastAnomalyTypeHash,
                persistenceSeconds, velocity, System.currentTimeMillis());
    }

    public SymbolTickState withPersistence(long sinceMs, int seconds, long typeHash) {
        return new SymbolTickState(symbol, lastRvol, lastConviction, sinceMs, typeHash,
                seconds, convictionVelocity, System.currentTimeMillis());
    }
}
