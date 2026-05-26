package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class CacheMetricsDto {
    int activeSymbols;
    int cachedSymbols;
    int ibkrSubscriptions;
    long estimatedMemoryKb;
}
