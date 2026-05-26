package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MarketTrendDto {
    String spyTrend;
    String qqqTrend;
    boolean marketAligned;
    String regime;
    String regimeSummary;
    boolean choppy;
    boolean riskOn;
    Double riskOnScore;
    String semiBreadth;
    String aiBreadth;
    Double spyPersistence;
    Double qqqPersistence;
}
