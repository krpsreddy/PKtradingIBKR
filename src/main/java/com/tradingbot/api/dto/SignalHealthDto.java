package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class SignalHealthDto {
    boolean ibkrConnected;
    boolean historicalLoaded;
    boolean liveStreaming;
    boolean liveSignalsEnabled;
    String marketStatus;
    boolean marketOpen;
    String estTime;
    List<EngineWindowDto> engines;
}
