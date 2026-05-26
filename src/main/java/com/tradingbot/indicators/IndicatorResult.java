package com.tradingbot.indicators;

import com.tradingbot.models.Candle;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;

@Value
@Builder
public class IndicatorResult {
    BigDecimal ema9;
    BigDecimal ema20;
    BigDecimal ema50;
    BigDecimal rsi;
    BigDecimal macd;
    BigDecimal signalLine;
    BigDecimal previousMacd;
    BigDecimal previousSignalLine;
    BigDecimal previousEma9;
    BigDecimal previousEma20;
    BigDecimal vwap;
    Long avgVolume;
    Long volume;
    BigDecimal relativeVolume;
    BigDecimal open;
    BigDecimal high;
    BigDecimal low;
    BigDecimal close;
    BigDecimal previousClose;
    Candle currentCandle;
    Candle previousCandle;
    List<Candle> recentCandles;
    boolean valid;
}
