package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class CandleChartDto {
    String time;
    double open;
    double high;
    double low;
    double close;
    double volume;
    Double ema9;
    Double ema20;
    Double ema50;
    Double vwap;
}
