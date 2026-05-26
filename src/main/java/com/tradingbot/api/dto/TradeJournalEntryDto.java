package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class TradeJournalEntryDto {
    Long id;
    String symbol;
    String setupType;
    String signalType;
    String entryTimestamp;
    BigDecimal entryPrice;
    BigDecimal exitPrice;
    String result;
    Double rrAchieved;
    String screenshotPath;
    String replayLink;
    String notes;
    String emotion;
    String mistakes;
    String lessons;
    String tradeQualityGrade;
    String createdAt;
    String updatedAt;
}
