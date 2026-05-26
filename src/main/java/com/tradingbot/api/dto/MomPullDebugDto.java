package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

@Value
@Builder
public class MomPullDebugDto {
    String symbol;
    boolean inSignalWindow;
    String sessionLabel;
    int requiredConfidence;
    int pullScore;
    int momScore;
    String pullScoreLabel;
    String momScoreLabel;
    boolean pullReady;
    boolean pullBuy;
    boolean momReady;
    boolean momBuy;
    Map<String, Boolean> pullConditions;
    Map<String, Boolean> momConditions;
    List<String> pullReasonChips;
    List<String> momReasonChips;
    List<String> pullFailedConditions;
    List<String> momFailedConditions;
}
