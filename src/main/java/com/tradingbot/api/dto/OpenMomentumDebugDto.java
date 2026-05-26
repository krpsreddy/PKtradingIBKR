package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

@Value
@Builder
public class OpenMomentumDebugDto {
    String symbol;
    boolean inOpenWindow;
    int score;
    String scoreLabel;
    Double gapPercent;
    Map<String, Boolean> conditions;
    List<String> reasonChips;
}
