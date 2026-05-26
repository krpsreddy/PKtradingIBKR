package com.tradingbot.intelligence.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class TradeQualityDto {
    /** A+, A, B, C, AVOID */
    String grade;
    int score;
}
