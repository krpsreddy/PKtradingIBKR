package com.tradingbot.signals;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.Candle;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import lombok.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fair Value Gap (FVG) imbalance — 3 consecutive candles where aggressive momentum
 * leaves a gap with no wick overlap between candle 1 and candle 3.
 * Bullish: low(c3) &gt; high(c1). Bearish: high(c3) &lt; low(c1).
 * Candle 2 is the impulse bar and must be a clean same-color body (no long wicks).
 */
@Component
public class ImbalanceBreakEvaluator {

    public static final int MAX_SCORE = 6;

    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;

    public ImbalanceBreakEvaluator(MarketHoursService marketHoursService, TradingProperties tradingProperties) {
        this.marketHoursService = marketHoursService;
        this.tradingProperties = tradingProperties;
    }

    @Value
    public static class ImbalanceEvaluation {
        boolean fvgFound;
        boolean bullishFvg;
        boolean bearishFvg;
        boolean gapSizeOk;
        boolean impulseCandle;
        boolean cleanWicks;
        boolean impulseVolume;
        boolean aboveVwap;
        boolean belowVwap;
        BigDecimal gapBoundaryHigh;
        BigDecimal gapBoundaryLow;
        double gapPct;

        public boolean isImbalanceDown() {
            return fvgFound && bearishFvg && gapSizeOk && impulseCandle && cleanWicks && downScore() >= 4;
        }

        public boolean isImbalanceUp() {
            return fvgFound && bullishFvg && gapSizeOk && impulseCandle && cleanWicks && upScore() >= 4;
        }

        public int downScore() {
            int score = 0;
            if (bearishFvg) score++;
            if (gapSizeOk) score++;
            if (impulseCandle) score++;
            if (cleanWicks) score++;
            if (impulseVolume) score++;
            if (belowVwap) score++;
            return Math.min(score, MAX_SCORE);
        }

        public int upScore() {
            int score = 0;
            if (bullishFvg) score++;
            if (gapSizeOk) score++;
            if (impulseCandle) score++;
            if (cleanWicks) score++;
            if (impulseVolume) score++;
            if (aboveVwap) score++;
            return Math.min(score, MAX_SCORE);
        }
    }

    public ImbalanceEvaluation evaluate(IndicatorResult i) {
        List<Candle> session = sessionCandles(i);
        if (session.size() < 3) {
            return emptyEval();
        }

        Candle c1 = session.get(session.size() - 3);
        Candle c2 = session.get(session.size() - 2);
        Candle c3 = session.get(session.size() - 1);

        boolean bullish = c3.getLow().compareTo(c1.getHigh()) > 0;
        boolean bearish = c3.getHigh().compareTo(c1.getLow()) < 0;
        if (!bullish && !bearish) {
            return emptyEval();
        }

        BigDecimal gapSize = bullish
                ? c3.getLow().subtract(c1.getHigh())
                : c1.getLow().subtract(c3.getHigh());
        double gapPct = gapSize.divide(c3.getClose(), 4, RoundingMode.HALF_UP).doubleValue();
        boolean gapOk = gapPct >= tradingProperties.getImbalanceMinGapPct();

        boolean impulseUp = isGreen(c2) && isStrongImpulse(c2);
        boolean impulseDown = isRed(c2) && isStrongImpulse(c2);
        boolean impulse = (bullish && impulseUp) || (bearish && impulseDown);
        boolean wicksOk = hasCleanWicks(c2);

        boolean volOk = hasImpulseVolume(c2, i);
        boolean aboveVwap = i.getClose().compareTo(i.getVwap()) > 0;
        boolean belowVwap = i.getClose().compareTo(i.getVwap()) < 0;

        BigDecimal gapHigh = bullish ? c1.getHigh() : c3.getHigh();
        BigDecimal gapLow = bullish ? c3.getLow() : c1.getLow();

        return new ImbalanceEvaluation(
                true, bullish, bearish, gapOk, impulse, wicksOk, volOk,
                aboveVwap, belowVwap, gapHigh, gapLow, gapPct
        );
    }

    private ImbalanceEvaluation emptyEval() {
        return new ImbalanceEvaluation(
                false, false, false, false, false, false, false,
                false, false, null, null, 0
        );
    }

    public String downLabel(int score) {
        if (score >= 5) return "STRONG IMBALANCE DOWN";
        if (score >= 4) return "IMBALANCE DOWN";
        return "WEAK IMBALANCE DOWN";
    }

    public String upLabel(int score) {
        if (score >= 5) return "STRONG IMBALANCE UP";
        if (score >= 4) return "IMBALANCE UP";
        return "WEAK IMBALANCE UP";
    }

    public List<String> buildDownChips(ImbalanceEvaluation eval) {
        List<String> chips = new ArrayList<>();
        if (eval.bearishFvg) chips.add("Bearish FVG Gap");
        if (eval.gapSizeOk) chips.add("Gap Size OK");
        if (eval.impulseCandle) chips.add("Clean Impulse Bar");
        if (eval.cleanWicks) chips.add("No Long Wicks");
        if (eval.impulseVolume) chips.add("Impulse Volume");
        if (eval.belowVwap) chips.add("Below VWAP");
        return chips;
    }

    public List<String> buildUpChips(ImbalanceEvaluation eval) {
        List<String> chips = new ArrayList<>();
        if (eval.bullishFvg) chips.add("Bullish FVG Gap");
        if (eval.gapSizeOk) chips.add("Gap Size OK");
        if (eval.impulseCandle) chips.add("Clean Impulse Bar");
        if (eval.cleanWicks) chips.add("No Long Wicks");
        if (eval.impulseVolume) chips.add("Impulse Volume");
        if (eval.aboveVwap) chips.add("Above VWAP");
        return chips;
    }

    public Map<String, Boolean> toDebugMap(ImbalanceEvaluation eval) {
        Map<String, Boolean> map = new LinkedHashMap<>();
        map.put("fvgFound", eval.fvgFound);
        map.put("bullishFvg", eval.bullishFvg);
        map.put("bearishFvg", eval.bearishFvg);
        map.put("gapSizeOk", eval.gapSizeOk);
        map.put("impulseCandle", eval.impulseCandle);
        map.put("cleanWicks", eval.cleanWicks);
        map.put("impulseVolume", eval.impulseVolume);
        map.put("belowVwap", eval.belowVwap);
        map.put("aboveVwap", eval.aboveVwap);
        map.put("imbalanceDown", eval.isImbalanceDown());
        map.put("imbalanceUp", eval.isImbalanceUp());
        return map;
    }

    private boolean isStrongImpulse(Candle c) {
        BigDecimal range = c.getHigh().subtract(c.getLow());
        if (range.compareTo(BigDecimal.ZERO) <= 0 || c.getClose().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        double rangePct = range.divide(c.getClose(), 4, RoundingMode.HALF_UP).doubleValue();
        if (rangePct < tradingProperties.getImbalanceMinImpulseRangePct()) {
            return false;
        }
        BigDecimal body = c.getClose().subtract(c.getOpen()).abs();
        BigDecimal bodyPct = body.divide(range, 4, RoundingMode.HALF_UP);
        return bodyPct.compareTo(BigDecimal.valueOf(tradingProperties.getImbalanceImpulseMinBodyPct())) >= 0;
    }

    private boolean hasCleanWicks(Candle c) {
        BigDecimal range = c.getHigh().subtract(c.getLow());
        if (range.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal bodyTop = c.getOpen().max(c.getClose());
        BigDecimal bodyBottom = c.getOpen().min(c.getClose());
        BigDecimal upperWick = c.getHigh().subtract(bodyTop);
        BigDecimal lowerWick = bodyBottom.subtract(c.getLow());
        BigDecimal maxWick = upperWick.max(lowerWick);
        BigDecimal maxWickPct = maxWick.divide(range, 4, RoundingMode.HALF_UP);
        return maxWickPct.compareTo(BigDecimal.valueOf(tradingProperties.getImbalanceMaxWickPct())) <= 0;
    }

    private boolean hasImpulseVolume(Candle impulse, IndicatorResult i) {
        if (i.getAvgVolume() == null || i.getAvgVolume() <= 0 || impulse.getVolume() == null) {
            return false;
        }
        long threshold = BigDecimal.valueOf(i.getAvgVolume())
                .multiply(BigDecimal.valueOf(tradingProperties.getImbalanceMinRvol()))
                .longValue();
        return impulse.getVolume() >= threshold;
    }

    private boolean isRed(Candle c) {
        return c.getClose().compareTo(c.getOpen()) < 0;
    }

    private boolean isGreen(Candle c) {
        return c.getClose().compareTo(c.getOpen()) > 0;
    }

    private List<Candle> sessionCandles(IndicatorResult i) {
        if (i.getRecentCandles() == null || i.getCurrentCandle() == null) {
            return List.of();
        }
        LocalDate sessionDay = MarketTime.toMarketZoned(i.getCurrentCandle().getOpenTime()).toLocalDate();
        return i.getRecentCandles().stream()
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .filter(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(sessionDay))
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
    }
}
