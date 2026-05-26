package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder(toBuilder = true)
public class OpeningMomentumDto {
    String symbol;
    Double gapPercent;
    Double relativeVolume;
    Integer confidenceScore;
    String confidenceLabel;
    String signalType;
    String lifecycleState;
    List<String> signalReasons;
    Integer rankScore;
    Integer rank;
    String mtfSummary;
    String freshness;
    String freshnessLabel;
    boolean extended;
    List<String> optionsWarnings;
}
