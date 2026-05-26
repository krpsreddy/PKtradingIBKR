package com.tradingbot.api.dto;

import com.tradingbot.api.dto.CandleChartDto;
import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class ReplayHistoryDto {
    String symbol;
    String replayDate;
    String timeframe;
    int totalBars;
    int simulatedSignals;
    List<CandleChartDto> sessionCandles;
    List<ReplaySignalEventDto> timeline;
    List<ReplayScorePointDto> scoreHistory;
    List<String> lifecyclePath;
}
