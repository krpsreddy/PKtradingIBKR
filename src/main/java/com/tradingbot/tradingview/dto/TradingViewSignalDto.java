package com.tradingbot.tradingview.dto;

/** Phase 217 — normalized TradingView intelligence signal (TV PUSH source). */
public record TradingViewSignalDto(
        String symbol,
        TradingViewDirection direction,
        int dominance,
        int conviction,
        int persistence,
        double rvol,
        String lifecycle,
        String regime,
        String executionQuality,
        int bearishBias,
        String putGrade,
        String deterioration,
        String conflictLevel,
        String pmState,
        long sourceTimestamp,
        long receivedAtMs,
        boolean stale,
        String source
) {
    public static final String SOURCE_TV = "TV";

    public static TradingViewSignalDto fresh(
            String symbol,
            TradingViewDirection direction,
            int dominance,
            int conviction,
            int persistence,
            double rvol,
            String lifecycle,
            String regime,
            String executionQuality,
            int bearishBias,
            String putGrade,
            String deterioration,
            String conflictLevel,
            String pmState,
            long sourceTimestamp,
            long receivedAtMs
    ) {
        return new TradingViewSignalDto(
                symbol,
                direction,
                dominance,
                conviction,
                persistence,
                rvol,
                lifecycle,
                regime,
                executionQuality,
                bearishBias,
                putGrade,
                deterioration,
                conflictLevel,
                pmState,
                sourceTimestamp,
                receivedAtMs,
                false,
                SOURCE_TV
        );
    }
}
