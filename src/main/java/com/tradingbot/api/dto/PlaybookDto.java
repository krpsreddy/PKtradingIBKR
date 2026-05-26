package com.tradingbot.api.dto;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.RegimePerformanceDto;
import lombok.Builder;
import lombok.Value;
import java.util.List;

@Value @Builder
public class PlaybookDto {
    String id;
    String name;
    List<String> idealConditions;
    List<String> avoidConditions;
    Double historicalWinRate;
    List<String> bestRegimes;
    String entryTiming;
    List<RegimePerformanceDto> regimePerformance;
    String contextualStatus;
    String contextualReason;
}
