package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;
import java.util.List;

@Value @Builder
public class TraderEdgeDto {
    int lookbackDays;
    int sampleSize;
    double overallWinRate;
    List<String> bestSetupTypes;
    List<String> worstSetupTypes;
    List<String> bestRegimes;
    List<String> bestTimeWindows;
    List<String> bestEntryQuality;
    String summary;
}
