package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ReplayScorePointDto {
    String timestamp;
    String engine;
    int score;
    String scoreLabel;
}
