package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

/** Stored candle coverage for a symbol within a lookback window — hydration planning only. */
@Value
@Builder
public class SymbolHistoryCoverageDto {
    String symbol;
    int lookbackDays;
    int loadedSessionDays;
    int totalCandles;
    String earliestTimestamp;
    String latestTimestamp;
    List<String> sessionDates;
    boolean fullyLoaded;
    String message;
}
