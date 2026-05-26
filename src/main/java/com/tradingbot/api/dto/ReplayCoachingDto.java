package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;
import java.util.List;

@Value @Builder
public class ReplayCoachingDto {
    String symbol;
    List<String> idealActions;
    List<String> dangerousSignals;
    List<String> lessons;
}
