package com.tradingbot.intelligence.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class SignalRankDto {
    int rankScore;
    int rank;
    List<String> boosters;
    List<String> penalties;
    List<String> optionsWarnings;
}
