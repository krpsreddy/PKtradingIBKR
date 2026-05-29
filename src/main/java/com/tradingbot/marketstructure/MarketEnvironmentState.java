package com.tradingbot.marketstructure;

/** Phase 196 — macro session environment for continuation filtering. */
public enum MarketEnvironmentState {
    TREND_DAY_BULL,
    TREND_DAY_BEAR,
    CHOP,
    OPENING_DRIVE,
    MIDDAY_DRIFT,
    POWER_HOUR,
    FAILED_BREAKOUT_ENV,
    LOW_PARTICIPATION,
    EXPANSION_ENV,
    DISTRIBUTION_ENV,
    SHORT_COVERING,
    RANGE_COMPRESSION
}
