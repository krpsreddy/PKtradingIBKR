package com.tradingbot.intelligence.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class RiskRewardDto {
    double entryPrice;
    double stopZone;
    double invalidationLevel;
    double targetPrice;
    double riskRewardRatio;
    /** STRONG, MEDIOCRE, POOR */
    String quality;
}
