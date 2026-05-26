package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SymbolSubscribeDto {
    String symbol;
    String status;
    boolean historicalLoaded;
    boolean liveSubscribed;
    boolean cached;
    int candleCount;
    String message;
}
