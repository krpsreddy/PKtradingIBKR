package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class DebugDto {
    String lastCandleTime;
    Double lastCandleClose;
    Long lastCandleVolume;
    String latestIndicators;
    String latestSignalReason;
    String lastSignalType;
    String lifecycleState;
    List<String> connectionLogs;
    CacheMetricsDto cacheMetrics;
    MarketTrendDto marketTrend;
}
