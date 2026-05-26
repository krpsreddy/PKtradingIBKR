package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder(toBuilder = true)
public class SignalDto {
    String symbol;
    String signalType;
    double price;
    String timestamp;
    Double rsi;
    Double macd;
    Double vwap;
    Double relativeVolume;
    Integer confidenceScore;
    String confidenceLabel;
    String signalReason;
    String lifecycleState;
    List<String> signalReasons;
    Integer rankScore;
    String mtfSummary;
    String freshness;
    String freshnessLabel;
    boolean extended;
    List<String> optionsWarnings;
}
