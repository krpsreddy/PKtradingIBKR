package com.tradingbot.intelligence.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class ExecutionIntelligenceDto {
    RiskRewardDto riskReward;
    TradeQualityDto tradeQuality;
    SetupDeteriorationDto deterioration;
    NoEdgeDto noEdge;
    List<String> whyNotReasons;
    String optionsGuidance;
    List<String> optionsWarnings;
    /** HIGH, MEDIUM, LOW */
    String alertPriority;
}
