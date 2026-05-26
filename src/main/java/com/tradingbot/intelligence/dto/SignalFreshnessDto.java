package com.tradingbot.intelligence.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SignalFreshnessDto {
    String freshness;
    long ageMinutes;
    String ageLabel;
    int freshnessScore;
    boolean staleForOptions;
}
