package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class ExecutionSnapshotDto {
    String symbol;
    Double estimatedRr;
    String rrQuality;
    Double entryPrice;
    Double stopZone;
    Double invalidationLevel;
    Double targetPrice;
    String tradeQualityGrade;
    Integer tradeQualityScore;
    String deteriorationState;
    List<String> deteriorationReasons;
    boolean noEdge;
    String noEdgeMessage;
    List<String> whyNotReasons;
    String optionsGuidance;
    List<String> optionsWarnings;
    String alertPriority;
}
