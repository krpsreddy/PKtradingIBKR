package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder(toBuilder = true)
public class ActiveSignalDto {
    String symbol;
    String signalType;
    Double price;
    Double rsi;
    Double relativeVolume;
    String timestamp;
    Integer confidenceScore;
    String confidenceLabel;
    String lifecycleState;
    String trend;
    List<String> signalReasons;
    Integer rankScore;
    String mtfSummary;
    String freshness;
    String freshnessLabel;
    boolean extended;
    List<String> optionsWarnings;
    Double estimatedRr;
    String rrQuality;
    String tradeQualityGrade;
    Integer tradeQualityScore;
    String deteriorationState;
    List<String> deteriorationReasons;
    Boolean noEdge;
    String noEdgeMessage;
    List<String> whyNotReasons;
    String alertPriority;
}
