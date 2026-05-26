package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

@Value
@Builder
public class RecoveryFailDebugDto {
    String symbol;
    boolean inRecoveryFailWindow;
    int score;
    String scoreLabel;
    String putSetupLabel;
    Double rallyFromLowPct;
    Map<String, Boolean> conditions;
    List<String> reasonChips;
    boolean recoveryFailSetup;
    boolean recoveryFailPending;
}
