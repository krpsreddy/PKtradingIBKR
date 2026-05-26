package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class EmergingSetupItemDto {
    String symbol;
    String state;
    String setupType;
    String description;
    Double relativeVolume;
    Integer rankScore;
}
