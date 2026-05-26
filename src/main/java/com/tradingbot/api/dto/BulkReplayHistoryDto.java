package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

/** Multi-session replay payload for Signal Intelligence bulk backfill. */
@Value
@Builder
public class BulkReplayHistoryDto {
    String symbol;
    int lookbackDays;
    int sessionsProcessed;
    int sessionsWithSignals;
    int totalSignals;
    int candlesStored;
    String historyStatus;
    String historyMessage;
    List<ReplayHistoryDto> sessions;
}
