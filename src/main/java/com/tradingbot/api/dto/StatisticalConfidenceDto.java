package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

@Value @Builder
public class StatisticalConfidenceDto {
    String signalType;
    String regime;
    double winRatePercent;
    String label;
}
