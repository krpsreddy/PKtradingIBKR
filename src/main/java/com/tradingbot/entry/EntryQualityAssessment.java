package com.tradingbot.entry;

public record EntryQualityAssessment(
        EntryQualityState state,
        int score,
        boolean autoExecutionAllowed,
        String reason
) {}
