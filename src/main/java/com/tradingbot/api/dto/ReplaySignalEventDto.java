package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

@Value
@Builder
public class ReplaySignalEventDto {
    String timestamp;
    String signalType;
    String lifecycleState;
    Integer score;
    String setupLabel;
    List<String> passedConditions;
    List<String> failedConditions;
    Double price;
    Double rvol;
    Double vwap;
    String vwapState;
    String trend;
    boolean extended;
    Map<String, Boolean> conditions;
}
