package com.tradingbot.intelligence.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class MarketRegimeDto {
    String regime;
    String spyTrend;
    String qqqTrend;
    boolean riskOn;
    boolean choppy;
    String summary;
}
