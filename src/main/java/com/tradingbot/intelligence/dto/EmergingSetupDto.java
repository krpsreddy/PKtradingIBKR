package com.tradingbot.intelligence.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class EmergingSetupDto {
    String symbol;
    /** BUILDING, READYING, NEAR_TRIGGER */
    String state;
    String setupType;
    String description;
    Double relativeVolume;
    Integer rankScore;
}
