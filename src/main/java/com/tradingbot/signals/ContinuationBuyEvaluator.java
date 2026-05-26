package com.tradingbot.signals;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.Candle;
import com.tradingbot.services.MarketTime;
import lombok.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class ContinuationBuyEvaluator {

    public static final String READINESS_CONT_READY = "CONT_READY";

    private static final BigDecimal STRONG_MOVE_PCT = BigDecimal.valueOf(0.05);
    private static final BigDecimal TIGHT_RANGE_PCT = BigDecimal.valueOf(0.015);
    private static final BigDecimal EARLIER_RVOL_THRESHOLD = BigDecimal.valueOf(2.0);
    private static final BigDecimal IMPULSE_RECLAIM_RATIO = BigDecimal.valueOf(0.985);
    private static final int CONSOLIDATION_BARS = 5;
    private static final int IMPULSE_LOOKBACK = 21;

    private final TradingProperties tradingProperties;

    public ContinuationBuyEvaluator(TradingProperties tradingProperties) {
        this.tradingProperties = tradingProperties;
    }

    @Value
    public static class ContEvaluation {
        boolean blockedByOpenFail;
        boolean bullishTrend;
        boolean strongEarlierMove;
        boolean tightConsolidation;
        boolean healthyConsolidation;
        boolean aboveVwap;
        boolean breakoutTrigger;
        boolean breakoutVolume;
        boolean momentumHealthy;
        boolean aboveSessionOpen;
        boolean reclaimsImpulseStructure;

        public boolean isContBuy() {
            return !blockedByOpenFail && bullishTrend && strongEarlierMove && tightConsolidation
                    && healthyConsolidation && aboveVwap && breakoutTrigger && breakoutVolume
                    && momentumHealthy;
        }

        public boolean isContReady() {
            return !blockedByOpenFail && bullishTrend && strongEarlierMove && tightConsolidation
                    && healthyConsolidation && aboveVwap && momentumHealthy && !breakoutTrigger;
        }

        public String readinessState() {
            return isContReady() ? READINESS_CONT_READY : "";
        }
    }

    public ContEvaluation evaluate(IndicatorResult i) {
        return evaluate(i, false);
    }

    public ContEvaluation evaluate(IndicatorResult i, boolean blockedByOpenFail) {
        List<Candle> candles = i.getRecentCandles() != null ? i.getRecentCandles() : List.of();
        Candle current = i.getCurrentCandle();
        int consEnd = candles.size() - 2;
        int consStart = Math.max(0, consEnd - (CONSOLIDATION_BARS - 1));
        BigDecimal sessionOpen = sessionOpenPrice(candles, current);
        BigDecimal impulseHigh = impulseHighBeforeConsolidation(candles, consStart);
        boolean breaksConsolidation = breaksConsolidationHigh(candles, i);
        boolean aboveOpen = sessionOpen != null && i.getClose().compareTo(sessionOpen) > 0;
        boolean reclaims = reclaimsImpulseStructure(i.getClose(), impulseHigh);

        return new ContEvaluation(
                blockedByOpenFail,
                hasBullishTrendStructure(i),
                hasStrongBullishEarlierMove(candles, i, consStart),
                isTightConsolidation(candles, i),
                isHealthyConsolidation(candles, i),
                i.getClose().compareTo(i.getVwap()) > 0,
                breaksConsolidation && aboveOpen && reclaims,
                isBreakoutVolume(i),
                isMomentumHealthy(i),
                aboveOpen,
                reclaims
        );
    }

    public int calculateConfidence(IndicatorResult i, ContEvaluation eval) {
        int score = 0;
        if (eval.aboveVwap) score++;
        if (eval.bullishTrend) score++;
        if (eval.strongEarlierMove) score++;
        if (eval.breakoutVolume) score++;
        if (i.getRsi().compareTo(BigDecimal.valueOf(55)) > 0) score++;
        if (i.getMacd().compareTo(i.getSignalLine()) > 0) score++;
        if (eval.tightConsolidation) score++;
        return score;
    }

    public String confidenceLabel(int score) {
        if (score >= 6) return "ELITE";
        if (score >= 4) return "STRONG";
        if (score >= 2) return "GOOD";
        return "WEAK";
    }

    public List<String> buildReasonChips(IndicatorResult i, ContEvaluation eval) {
        List<String> chips = new ArrayList<>();
        if (eval.bullishTrend) chips.add("Bullish Trend");
        if (eval.tightConsolidation) chips.add("Tight Consolidation");
        if (eval.aboveVwap) chips.add("Above VWAP");
        if (eval.breakoutVolume) chips.add("Breakout Volume");
        if (eval.strongEarlierMove) chips.add("Bullish Earlier Move");
        if (eval.healthyConsolidation) chips.add("Healthy Consolidation");
        if (eval.breakoutTrigger) chips.add("Continuation Setup");
        if (eval.aboveSessionOpen) chips.add("Above Session Open");
        if (eval.reclaimsImpulseStructure) chips.add("Reclaims Impulse Structure");
        if (i.getMacd().compareTo(i.getSignalLine()) > 0) chips.add("MACD Bullish");
        if (i.getRsi().compareTo(BigDecimal.valueOf(55)) > 0) chips.add("RSI Strong");
        return chips;
    }

    public Map<String, Boolean> toDebugMap(ContEvaluation eval) {
        Map<String, Boolean> map = new LinkedHashMap<>();
        map.put("blockedByOpenFail", eval.blockedByOpenFail);
        map.put("bullishTrend", eval.bullishTrend);
        map.put("strongEarlierMove", eval.strongEarlierMove);
        map.put("tightConsolidation", eval.tightConsolidation);
        map.put("healthyConsolidation", eval.healthyConsolidation);
        map.put("aboveVwap", eval.aboveVwap);
        map.put("aboveSessionOpen", eval.aboveSessionOpen);
        map.put("reclaimsImpulseStructure", eval.reclaimsImpulseStructure);
        map.put("breakoutTrigger", eval.breakoutTrigger);
        map.put("breakoutVolume", eval.breakoutVolume);
        map.put("momentumHealthy", eval.momentumHealthy);
        map.put("contBuy", eval.isContBuy());
        map.put("contReady", eval.isContReady());
        return map;
    }

    private boolean hasBullishTrendStructure(IndicatorResult i) {
        return i.getEma9().compareTo(i.getEma20()) > 0
                && i.getEma20().compareTo(i.getEma50()) > 0
                && i.getClose().compareTo(i.getEma20()) > 0;
    }

    private boolean hasStrongBullishEarlierMove(List<Candle> candles, IndicatorResult i, int consStart) {
        if (hasBullishImpulseBar(candles, i, consStart)) {
            return true;
        }
        if (candles.size() >= IMPULSE_LOOKBACK + 1) {
            BigDecimal closeLookback = candles.get(candles.size() - IMPULSE_LOOKBACK - 1).getClose();
            if (closeLookback.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal change = i.getClose().subtract(closeLookback)
                        .divide(closeLookback, 4, RoundingMode.HALF_UP);
                return change.compareTo(STRONG_MOVE_PCT) > 0;
            }
        }
        return false;
    }

    private boolean hasBullishImpulseBar(List<Candle> candles, IndicatorResult i, int consStart) {
        if (candles.size() < 2 || i.getAvgVolume() == null || i.getAvgVolume() <= 0) {
            return false;
        }
        int from = Math.max(0, candles.size() - IMPULSE_LOOKBACK);
        int to = Math.max(from, consStart);
        for (int idx = from; idx < to; idx++) {
            Candle c = candles.get(idx);
            boolean green = c.getClose().compareTo(c.getOpen()) > 0;
            long vol = c.getVolume() != null ? c.getVolume() : 0L;
            BigDecimal rvol = relativeVolume(vol, i.getAvgVolume());
            if (green && rvol.compareTo(EARLIER_RVOL_THRESHOLD) > 0) {
                return true;
            }
        }
        return false;
    }

    private boolean isTightConsolidation(List<Candle> candles, IndicatorResult i) {
        if (candles.size() < CONSOLIDATION_BARS + 1 || i.getClose().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        int end = candles.size() - 2;
        int start = Math.max(0, end - (CONSOLIDATION_BARS - 1));
        BigDecimal maxHigh = null;
        BigDecimal minLow = null;
        for (int idx = start; idx <= end; idx++) {
            Candle c = candles.get(idx);
            maxHigh = maxHigh == null ? c.getHigh() : maxHigh.max(c.getHigh());
            minLow = minLow == null ? c.getLow() : minLow.min(c.getLow());
        }
        if (maxHigh == null || minLow == null) {
            return false;
        }
        BigDecimal rangePct = maxHigh.subtract(minLow)
                .divide(i.getClose(), 4, RoundingMode.HALF_UP);
        return rangePct.compareTo(TIGHT_RANGE_PCT) < 0;
    }

    private boolean isHealthyConsolidation(List<Candle> candles, IndicatorResult i) {
        if (candles.size() < 3 || i.getAvgVolume() == null || i.getAvgVolume() <= 0) {
            return false;
        }
        long avg = i.getAvgVolume();
        for (int idx = candles.size() - 3; idx <= candles.size() - 2; idx++) {
            long vol = candles.get(idx).getVolume() != null ? candles.get(idx).getVolume() : 0L;
            if (vol >= avg) {
                return false;
            }
        }
        return true;
    }

    private boolean breaksConsolidationHigh(List<Candle> candles, IndicatorResult i) {
        if (candles.size() < 4) {
            return false;
        }
        int end = candles.size() - 2;
        int start = Math.max(0, end - 2);
        BigDecimal consolidationHigh = null;
        for (int idx = start; idx <= end; idx++) {
            BigDecimal high = candles.get(idx).getHigh();
            consolidationHigh = consolidationHigh == null ? high : consolidationHigh.max(high);
        }
        return consolidationHigh != null && i.getClose().compareTo(consolidationHigh) > 0;
    }

    private boolean reclaimsImpulseStructure(BigDecimal close, BigDecimal impulseHigh) {
        if (impulseHigh == null || impulseHigh.compareTo(BigDecimal.ZERO) <= 0) {
            return true;
        }
        BigDecimal threshold = impulseHigh.multiply(IMPULSE_RECLAIM_RATIO);
        return close.compareTo(threshold) >= 0;
    }

    private BigDecimal impulseHighBeforeConsolidation(List<Candle> candles, int consStart) {
        BigDecimal max = null;
        for (int idx = 0; idx < consStart; idx++) {
            BigDecimal high = candles.get(idx).getHigh();
            max = max == null ? high : max.max(high);
        }
        return max;
    }

    private BigDecimal sessionOpenPrice(List<Candle> candles, Candle current) {
        if (candles.isEmpty() || current == null) {
            return null;
        }
        LocalDate sessionDay = MarketTime.toMarketZoned(current.getOpenTime()).toLocalDate();
        for (Candle c : candles) {
            if (MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(sessionDay)) {
                return c.getOpen();
            }
        }
        return candles.get(0).getOpen();
    }

    private boolean isBreakoutVolume(IndicatorResult i) {
        if (i.getAvgVolume() == null || i.getAvgVolume() <= 0) {
            return false;
        }
        long threshold = BigDecimal.valueOf(i.getAvgVolume())
                .multiply(BigDecimal.valueOf(tradingProperties.getContBreakoutMinRvol()))
                .longValue();
        return i.getVolume() != null && i.getVolume() > threshold;
    }

    private boolean isMomentumHealthy(IndicatorResult i) {
        return i.getRsi().compareTo(BigDecimal.valueOf(50)) > 0
                && i.getMacd().compareTo(i.getSignalLine()) > 0;
    }

    private BigDecimal relativeVolume(long volume, long avgVolume) {
        if (avgVolume <= 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf((double) volume / avgVolume).setScale(2, RoundingMode.HALF_UP);
    }
}
