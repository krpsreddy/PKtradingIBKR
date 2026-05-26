package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class ReplayEventDto {
    String symbol;
    String timestamp;
    String signalType;
    String lifecycleState;
    Integer score;
    List<String> passedConditions;
    List<String> failedConditions;
    Double price;
    Long volume;
    Double rvol;
    String vwapState;
}
