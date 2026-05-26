package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class IndicatorDto {
    double ema9;
    double ema20;
    double ema50;
    double rsi;
    double macd;
    double signalLine;
    double vwap;
    long avgVolume;
    double relativeVolume;
    String timestamp;
}
