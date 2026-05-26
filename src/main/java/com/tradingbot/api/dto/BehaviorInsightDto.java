package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

@Value @Builder
public class BehaviorInsightDto {
    String type;
    String title;
    String detail;
}
