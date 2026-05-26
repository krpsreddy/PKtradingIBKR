package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder(toBuilder = true)
public class HotMomentumDto {
    String symbol;
    Integer confidenceScore;
    String confidenceLabel;
    Double relativeVolume;
    String trend;
    String signalType;
    String lifecycleState;
    List<String> signalReasons;
    String timestamp;
    Integer rankScore;
    Integer rank;
    String mtfSummary;
    String freshness;
    String freshnessLabel;
    boolean extended;
    String extendedState;
    List<String> optionsWarnings;
}
