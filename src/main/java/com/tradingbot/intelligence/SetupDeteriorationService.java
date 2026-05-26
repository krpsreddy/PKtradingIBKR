package com.tradingbot.intelligence;

import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.SetupDeteriorationDto;
import com.tradingbot.models.Candle;
import com.tradingbot.models.TradingSignal;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class SetupDeteriorationService {

    public SetupDeteriorationDto analyze(IndicatorResult indicators, TradingSignal signal,
                                         List<Candle> sessionCandles) {
        List<String> reasons = new ArrayList<>();
        int severity = 0;

        if (signal != null) {
            if ("WEAKENING".equals(signal.getLifecycleState())) {
                reasons.add("Lifecycle weakening");
                severity += 2;
            }
            if ("INVALIDATED".equals(signal.getLifecycleState())) {
                reasons.add("Setup invalidated");
                severity += 4;
            }
        }

        if (indicators != null) {
            double rvol = indicators.getRelativeVolume() != null
                    ? indicators.getRelativeVolume().doubleValue() : 0;
            if (rvol > 0 && rvol < 1.2) {
                reasons.add("Weakening RVOL");
                severity += 1;
            }

            if (indicators.getMacd() != null && indicators.getSignalLine() != null
                    && indicators.getMacd().compareTo(indicators.getSignalLine()) < 0) {
                reasons.add("Flattening MACD");
                severity += 1;
            }

            double price = resolvePrice(indicators, signal);
            double vwap = toDouble(indicators.getVwap());
            boolean bullish = signal == null || SignalRankingEngine.isBullishSignalType(signal.getSignalType());
            if (price > 0 && vwap > 0 && bullish && price < vwap) {
                reasons.add("VWAP weakness");
                severity += 2;
            }

            if (sessionCandles != null && sessionCandles.size() >= 3 && bullish) {
                Candle last = sessionCandles.get(sessionCandles.size() - 1);
                Candle prev = sessionCandles.get(sessionCandles.size() - 2);
                if (last.getHigh() != null && prev.getHigh() != null
                        && last.getHigh().compareTo(prev.getHigh()) < 0) {
                    reasons.add("Lower highs forming");
                    severity += 1;
                }
                if (last.getClose() != null && last.getOpen() != null
                        && last.getClose().compareTo(last.getOpen()) < 0) {
                    reasons.add("Weak candle close");
                    severity += 1;
                }
            }
        }

        String state = "STABLE";
        if (severity >= 4) state = "FAILING";
        else if (severity >= 2) state = "WEAKENING";

        Set<String> unique = new LinkedHashSet<>(reasons);
        return SetupDeteriorationDto.builder()
                .state(state)
                .reasons(new ArrayList<>(unique))
                .build();
    }

    private double resolvePrice(IndicatorResult indicators, TradingSignal signal) {
        if (signal != null && signal.getPrice() != null) {
            return signal.getPrice().doubleValue();
        }
        if (sessionClose(indicators) != null) return sessionClose(indicators);
        return toDouble(indicators.getEma9());
    }

    private Double sessionClose(IndicatorResult indicators) {
        if (indicators.getRecentCandles() == null || indicators.getRecentCandles().isEmpty()) {
            return null;
        }
        BigDecimal close = indicators.getRecentCandles().get(indicators.getRecentCandles().size() - 1).getClose();
        return close != null ? close.doubleValue() : null;
    }

    private static double toDouble(BigDecimal v) {
        return v != null ? v.doubleValue() : 0;
    }
}
