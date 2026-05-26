package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

@Value
@Builder
public class OpenFailDebugDto {
    String symbol;
    boolean inOpenFailWindow;
    int score;
    String scoreLabel;
    String putSetupLabel;
    Double upperWickPercent;
    Map<String, Boolean> conditions;
    List<String> reasonChips;
    boolean openFail;
    boolean openFailSetup;
    boolean openFailBreak;
    boolean openFailPending;
    int breakScore;
    String breakScoreLabel;
    List<String> breakReasonChips;
}
