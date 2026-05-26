package com.tradingbot.candle;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record LiveCandleSnapshot(
        String symbol,
        LocalDateTime openTime,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal close,
        long volume
) {}
