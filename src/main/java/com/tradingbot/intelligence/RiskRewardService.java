package com.tradingbot.intelligence;

import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.RiskRewardDto;
import com.tradingbot.models.TradingSignal;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class RiskRewardService {

    private static final double BULL_TARGET_PCT = 0.015;
    private static final double BEAR_TARGET_PCT = 0.015;

    public RiskRewardDto calculate(IndicatorResult indicators, TradingSignal signal, boolean bullish) {
        if (indicators == null) {
            return empty();
        }
        double price = resolvePrice(indicators, signal);
        double vwap = toDouble(indicators.getVwap());
        double ema9 = toDouble(indicators.getEma9());
        double ema20 = toDouble(indicators.getEma20());

        double stopZone = bullish
                ? Math.min(vwap, ema9) * 0.995
                : Math.max(vwap, ema9) * 1.005;
        double invalidation = bullish
                ? Math.min(ema20, vwap) * 0.992
                : Math.max(ema20, vwap) * 1.008;
        double target = bullish
                ? price * (1 + BULL_TARGET_PCT)
                : price * (1 - BEAR_TARGET_PCT);

        double risk = Math.abs(price - invalidation);
        double reward = Math.abs(target - price);
        double rr = risk > 0.0001 ? round1(reward / risk) : 0;

        return RiskRewardDto.builder()
                .entryPrice(round2(price))
                .stopZone(round2(stopZone))
                .invalidationLevel(round2(invalidation))
                .targetPrice(round2(target))
                .riskRewardRatio(rr)
                .quality(classifyRr(rr))
                .build();
    }

    public String classifyRr(double rr) {
        if (rr >= 2.5) return "STRONG";
        if (rr >= 1.5) return "MEDIOCRE";
        return "POOR";
    }

    private double resolvePrice(IndicatorResult indicators, TradingSignal signal) {
        if (signal != null && signal.getPrice() != null) {
            return signal.getPrice().doubleValue();
        }
        if (indicators.getClose() != null) return indicators.getClose().doubleValue();
        if (indicators.getRecentCandles() != null && !indicators.getRecentCandles().isEmpty()) {
            BigDecimal close = indicators.getRecentCandles().get(indicators.getRecentCandles().size() - 1).getClose();
            if (close != null) return close.doubleValue();
        }
        return toDouble(indicators.getEma9());
    }

    private RiskRewardDto empty() {
        return RiskRewardDto.builder()
                .entryPrice(0).stopZone(0).invalidationLevel(0).targetPrice(0)
                .riskRewardRatio(0).quality("POOR").build();
    }

    private static double toDouble(BigDecimal v) {
        return v != null ? v.doubleValue() : 0;
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    private static double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
