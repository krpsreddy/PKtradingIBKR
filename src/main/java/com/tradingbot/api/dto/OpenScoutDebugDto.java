package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

@Value
@Builder
public class OpenScoutDebugDto {
    String symbol;
    boolean inScoutWindow;
    int score;
    String scoreLabel;
    Double gapPercent;
    Double estimatedRvol;
    Double liveBodyStrength;
    Boolean premarketBreakout;
    Boolean aboveVwap;
    Map<String, Object> conditions;
    List<String> reasonChips;
    boolean scoutActive;
    boolean scoutFailed;
}
