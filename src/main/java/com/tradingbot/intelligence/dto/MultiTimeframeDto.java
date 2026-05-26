package com.tradingbot.intelligence.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MultiTimeframeDto {
    String trend5m;
    String trend15m;
    String trend1h;
    int alignmentScore;
    boolean alignedBullish;
    boolean alignedBearish;
    String summary;
}
