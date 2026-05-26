package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SystemStatusDto {
    boolean ibkrConnected;
    boolean historicalLoaded;
    boolean liveStreaming;
    boolean marketOpen;
    String marketStatus;
    String symbol;
    Double livePrice;
    String lastUpdate;
}
