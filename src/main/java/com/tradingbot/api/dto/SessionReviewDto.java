package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;
import java.util.List;

@Value @Builder
public class SessionReviewDto {
    String sessionDate;
    List<String> topSetups;
    List<String> missedOpportunities;
    List<String> strongestSectors;
    List<String> failedSetups;
    List<String> regimeShifts;
    String summary;
}
