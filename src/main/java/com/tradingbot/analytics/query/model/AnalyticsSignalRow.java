package com.tradingbot.analytics.query.model;

/** Normalized row for in-memory analytics aggregation. */
public record AnalyticsSignalRow(
        String signalId,
        String symbol,
        String decision,
        String narrative,
        String quality,
        String resultBucket,
        int conviction,
        String convictionBand,
        double resultR,
        Double mfe,
        Double mae,
        double continuationPercent,
        boolean fakeout,
        boolean winner,
        String winLoss,
        double regretScore,
        boolean suppressedWinner,
        boolean fullExecution
) {}
