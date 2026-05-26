package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

@Value @Builder
public class MarketMemoryDto {
    String sessionDate;
    List<String> strongestSetups;
    List<String> failingSetups;
    Double openMomentumSuccessRate;
    Double continuationSuccessRate;
    int emergingSetupCount;
    /** Rolling multi-day narratives. */
    List<String> narratives;
    /** Setup win rates by regime over lookback window. */
    Map<String, Double> regimeSetupWinRates;
    Double fakeBreakoutFrequency;
    Double middayDeteriorationRate;
    Double closeStrengthRate;
    int lookbackDays;
}
