package com.tradingbot.signals;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.Candle;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import com.tradingbot.symbol.SymbolContext;
import lombok.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class OpenFailEvaluator {

    public static final String READINESS_OPEN_FAIL_READY = "OPEN_FAIL_READY";
    public static final int MAX_SCORE = 7;

    private static final LocalTime OPEN_FAIL_BREAK_START = LocalTime.of(9, 40);
    private static final BigDecimal OPENING_RANGE_PCT = BigDecimal.valueOf(0.02);
    private static final BigDecimal UPPER_WICK_PCT = BigDecimal.valueOf(0.40);
    private static final BigDecimal SELL_VOLUME_MULT = BigDecimal.valueOf(1.5);
    private static final BigDecimal MIN_PRICE = BigDecimal.valueOf(5);
    private static final BigDecimal SESSION_LOW_BUFFER = BigDecimal.valueOf(0.01);

    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;

    public OpenFailEvaluator(MarketHoursService marketHoursService, TradingProperties tradingProperties) {
        this.marketHoursService = marketHoursService;
        this.tradingProperties = tradingProperties;
    }

    @Value
    public static class FailEvaluation {
        boolean earlierOpenMomentum;
        boolean largeUpperWick;
        boolean failedOrb;
        boolean lostVwap;
        boolean bearishMomentumShift;
        boolean highSellVolume;
        boolean failedFollowThrough;
        boolean lowerHighs;
        boolean rejectionAfterOpenMom;
        boolean liquidityOk;
        boolean openFailBreak;
        boolean openFailSetup;
        boolean inBreakWindow;
        boolean redCandle;
        boolean notAtSessionLow;
        boolean openSelloffBreak;
        double upperWickPercent;

        /** Wick rejection setup — requires confirmation bar before firing OPEN_FAIL. */
        public boolean isOpenFailSetup() {
            return openFailSetup;
        }

        /** @deprecated use {@link #isOpenFailSetup()} */
        public boolean isOpenFail() {
            return isOpenFailSetup();
        }

        /** Early breakdown entry during selloff (tradeable PUT timing). */
        public boolean isOpenFailBreak() {
            return openFailBreak;
        }

        public String readinessState() {
            return isOpenFailSetup() ? READINESS_OPEN_FAIL_READY : "";
        }

        public int calculateScore() {
            int score = 0;
            if (largeUpperWick) score++;
            if (lostVwap) score++;
            if (failedOrb) score++;
            if (bearishMomentumShift) score++;
            if (highSellVolume) score++;
            if (lowerHighs || failedFollowThrough) score++;
            if (rejectionAfterOpenMom) score++;
            return Math.min(score, MAX_SCORE);
        }

        public int calculateBreakScore() {
            int score = 0;
            if (earlierOpenMomentum) score++;
            if (failedOrb) score++;
            if (lostVwap) score++;
            if (bearishMomentumShift) score++;
            if (highSellVolume) score++;
            if (redCandle) score++;
            if (inBreakWindow) score++;
            return score;
        }
    }

    public FailEvaluation evaluate(IndicatorResult i, SymbolContext ctx,
                                   boolean hadOpenScout, boolean hadOpenReady,
                                   boolean hadOpenMom, Long avgDailyVolume,
                                   long minBarVolume, long minAvgDailyVolume) {
        List<Candle> sessionToday = sessionCandlesToday(i.getRecentCandles(), i.getCurrentCandle());
        Candle current = i.getCurrentCandle();
        ZonedDateTime barTime = current != null ? MarketTime.toMarketZoned(current.getOpenTime()) : null;

        boolean liquidityOk = passesLiquidity(i, avgDailyVolume, minBarVolume, minAvgDailyVolume);
        boolean earlierMomentum = hadOpenScout || hadOpenReady || hadOpenMom
                || hasStrongOpeningRange(sessionToday);
        boolean upperWick = isLargeUpperWick(i);
        double wickPct = upperWickPercent(i);
        boolean failedOrb = isFailedOrb(i, ctx, sessionToday)
                || isOpeningRangeBreakdown(sessionToday, i, ctx);
        boolean lostVwap = i.getClose().compareTo(i.getVwap()) < 0;
        boolean bearishShift = isBearishMomentumShift(i);
        boolean sellVol = isHighSellVolume(i);
        boolean failedFt = isFailedFollowThrough(sessionToday, current);
        boolean lowerHighs = isLowerHighs(sessionToday);
        boolean afterOpenMom = hadOpenMom || hadOpenScout || hadOpenReady;
        boolean redCandle = isRedCandle(i);
        boolean inBreakWindow = isInBreakWindow(barTime);
        boolean notAtLow = !isAtSessionLow(sessionToday, i);
        boolean selloffBreak = isOpenSelloffBreak(sessionToday, i, lostVwap, sellVol, redCandle, inBreakWindow);

        boolean setup = liquidityOk && earlierMomentum && upperWick && failedOrb && lostVwap
                && notAtLow && (bearishShift || sellVol || failedFt);

        boolean breakSignal = liquidityOk && inBreakWindow && redCandle && lostVwap && bearishShift
                && failedOrb && (earlierMomentum || sessionToday.size() <= 4)
                && (selloffBreak || (notAtLow && (sellVol || failedFt || lowerHighs)));

        return new FailEvaluation(
                earlierMomentum, upperWick, failedOrb, lostVwap, bearishShift,
                sellVol, failedFt, lowerHighs, afterOpenMom, liquidityOk,
                breakSignal, setup, inBreakWindow, redCandle, notAtLow, selloffBreak, wickPct
        );
    }

    public boolean isConfirmationBar(IndicatorResult i, BigDecimal setupBarLow) {
        if (!isRedCandle(i) || setupBarLow == null) {
            return false;
        }
        List<Candle> sessionToday = sessionCandlesToday(i.getRecentCandles(), i.getCurrentCandle());
        if (isAtSessionLow(sessionToday, i)) {
            return false;
        }
        if (isLargeLowerWick(i)) {
            return false;
        }
        return i.getClose().compareTo(setupBarLow) < 0;
    }

    /** @deprecated use {@link #isConfirmationBar(IndicatorResult, BigDecimal)} */
    public boolean isConfirmationBar(IndicatorResult i) {
        return isRedCandle(i) && !isLargeLowerWick(i);
    }

    public String scoreLabel(int score) {
        if (score >= 6) return "ELITE OPEN FAIL";
        if (score >= 4) return "STRONG OPEN FAIL";
        if (score >= 2) return "WEAK OPEN FAIL";
        return "NO FAIL";
    }

    public String breakScoreLabel(int score) {
        if (score >= 5) return "STRONG BREAKDOWN";
        if (score >= 3) return "BREAKDOWN";
        return "WEAK BREAKDOWN";
    }

    public String putSetupLabel(int score) {
        return score >= 4 ? "PUT SETUP" : "";
    }

    public List<String> buildReasonChips(FailEvaluation eval) {
        List<String> chips = new ArrayList<>();
        if (eval.earlierOpenMomentum) chips.add("Earlier Opening Momentum");
        if (eval.largeUpperWick) chips.add("Heavy Rejection Wick");
        if (eval.failedOrb) chips.add("Failed ORB Breakout");
        if (eval.lostVwap) chips.add("Lost VWAP");
        if (eval.bearishMomentumShift) chips.add("Bearish Momentum Shift");
        if (eval.highSellVolume) chips.add("High Sell Volume");
        if (eval.failedFollowThrough) chips.add("Failed Follow-Through");
        if (eval.lowerHighs) chips.add("Lower Highs Forming");
        if (eval.rejectionAfterOpenMom) chips.add("Rejection After Open Momentum");
        return chips;
    }

    public List<String> buildBreakReasonChips(FailEvaluation eval) {
        List<String> chips = new ArrayList<>();
        if (eval.earlierOpenMomentum) chips.add("Earlier Opening Momentum");
        if (eval.failedOrb) chips.add("Failed ORB Breakout");
        if (eval.lostVwap) chips.add("Lost VWAP");
        if (eval.bearishMomentumShift) chips.add("Bearish Momentum Shift");
        if (eval.highSellVolume) chips.add("High Sell Volume");
        if (eval.redCandle) chips.add("Breakdown Candle");
        if (eval.openSelloffBreak) chips.add("Open Selloff Break");
        if (eval.inBreakWindow) chips.add("Early Break Window");
        if (eval.notAtSessionLow) chips.add("Not At Session Low");
        return chips;
    }

    public Map<String, Boolean> toDebugMap(FailEvaluation eval) {
        Map<String, Boolean> map = new LinkedHashMap<>();
        map.put("liquidityOk", eval.liquidityOk);
        map.put("earlierOpenMomentum", eval.earlierOpenMomentum);
        map.put("largeUpperWick", eval.largeUpperWick);
        map.put("failedOrb", eval.failedOrb);
        map.put("lostVwap", eval.lostVwap);
        map.put("bearishMomentumShift", eval.bearishMomentumShift);
        map.put("highSellVolume", eval.highSellVolume);
        map.put("failedFollowThrough", eval.failedFollowThrough);
        map.put("lowerHighs", eval.lowerHighs);
        map.put("rejectionAfterOpenMom", eval.rejectionAfterOpenMom);
        map.put("openFailSetup", eval.isOpenFailSetup());
        map.put("openSelloffBreak", eval.openSelloffBreak);
        map.put("openFailBreak", eval.isOpenFailBreak());
        map.put("inBreakWindow", eval.inBreakWindow);
        map.put("redCandle", eval.redCandle);
        map.put("notAtSessionLow", eval.notAtSessionLow);
        map.put("openFail", eval.isOpenFailSetup());
        return map;
    }

    private boolean isInBreakWindow(ZonedDateTime barTime) {
        if (barTime == null) {
            return false;
        }
        LocalTime end = parseBreakEnd();
        LocalTime time = barTime.toLocalTime();
        return !time.isBefore(OPEN_FAIL_BREAK_START) && !time.isAfter(end);
    }

    private LocalTime parseBreakEnd() {
        try {
            return LocalTime.parse(tradingProperties.getOpenFailBreakEnd());
        } catch (Exception e) {
            return LocalTime.of(10, 15);
        }
    }

    private boolean isOpeningRangeBreakdown(List<Candle> sessionToday, IndicatorResult i, SymbolContext ctx) {
        if (sessionToday.isEmpty()) {
            return false;
        }
        BigDecimal orbLow = ctx != null && ctx.getOpeningRangeLow() != null
                ? ctx.getOpeningRangeLow()
                : sessionToday.get(0).getLow();
        BigDecimal sessionOpen = sessionToday.get(0).getOpen();
        if (i.getClose().compareTo(orbLow) < 0 && i.getClose().compareTo(i.getVwap()) < 0 && isRedCandle(i)) {
            return true;
        }
        return sessionToday.size() <= 4 && isRedCandle(i)
                && i.getClose().compareTo(sessionOpen) < 0
                && isStrongRedBody(i)
                && i.getClose().compareTo(i.getVwap()) < 0;
    }

    private boolean isOpenSelloffBreak(List<Candle> sessionToday, IndicatorResult i,
                                       boolean lostVwap, boolean sellVol,
                                       boolean redCandle, boolean inBreakWindow) {
        if (!inBreakWindow || !redCandle || !lostVwap || !sellVol || sessionToday.size() > 4) {
            return false;
        }
        if (!isStrongRedBody(i)) {
            return false;
        }
        BigDecimal sessionOpen = sessionToday.get(0).getOpen();
        return i.getClose().compareTo(sessionOpen) < 0;
    }

    private boolean isStrongRedBody(IndicatorResult i) {
        BigDecimal range = i.getHigh().subtract(i.getLow());
        if (range.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal body = i.getOpen().subtract(i.getClose());
        return body.divide(range, 4, RoundingMode.HALF_UP)
                .compareTo(BigDecimal.valueOf(tradingProperties.getOpenFailSelloffMinBodyPct())) >= 0;
    }

    private boolean isRedCandle(IndicatorResult i) {
        return i.getClose().compareTo(i.getOpen()) < 0;
    }

    private boolean isAtSessionLow(List<Candle> sessionToday, IndicatorResult i) {
        if (sessionToday.isEmpty() || i.getClose().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal sessionLow = sessionToday.stream()
                .map(Candle::getLow)
                .min(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);
        if (sessionLow.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal buffer = sessionLow.multiply(BigDecimal.ONE.add(SESSION_LOW_BUFFER));
        return i.getClose().compareTo(buffer) <= 0;
    }

    private boolean passesLiquidity(IndicatorResult i, Long avgDailyVolume,
                                    long minBarVolume, long minAvgDailyVolume) {
        if (i.getClose().compareTo(MIN_PRICE) < 0) return false;
        long vol = i.getVolume() != null ? i.getVolume() : 0;
        if (vol < minBarVolume / 2) return false;
        if (avgDailyVolume != null && avgDailyVolume > 0 && avgDailyVolume < minAvgDailyVolume) {
            return false;
        }
        return true;
    }

    private boolean hasStrongOpeningRange(List<Candle> sessionToday) {
        if (sessionToday.isEmpty()) return false;
        Candle first = sessionToday.get(0);
        BigDecimal range = first.getHigh().subtract(first.getLow());
        if (first.getLow().compareTo(BigDecimal.ZERO) <= 0) return false;
        return range.divide(first.getLow(), 4, RoundingMode.HALF_UP).compareTo(OPENING_RANGE_PCT) > 0;
    }

    private boolean isLargeUpperWick(IndicatorResult i) {
        return upperWickPercent(i) > UPPER_WICK_PCT.doubleValue();
    }

    private double upperWickPercent(IndicatorResult i) {
        BigDecimal range = i.getHigh().subtract(i.getLow());
        if (range.compareTo(BigDecimal.ZERO) <= 0) return 0;
        BigDecimal top = i.getOpen().max(i.getClose());
        BigDecimal upperWick = i.getHigh().subtract(top);
        return upperWick.divide(range, 4, RoundingMode.HALF_UP).doubleValue();
    }

    private boolean isLargeLowerWick(IndicatorResult i) {
        return lowerWickPercent(i) > tradingProperties.getOpenFailMaxLowerWickPct();
    }

    private double lowerWickPercent(IndicatorResult i) {
        BigDecimal range = i.getHigh().subtract(i.getLow());
        if (range.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        BigDecimal bottom = i.getOpen().min(i.getClose());
        BigDecimal lowerWick = bottom.subtract(i.getLow());
        return lowerWick.divide(range, 4, RoundingMode.HALF_UP).doubleValue();
    }

    private boolean isFailedOrb(IndicatorResult i, SymbolContext ctx, List<Candle> sessionToday) {
        BigDecimal orbHigh = ctx != null ? ctx.getOpeningRangeHigh() : null;
        BigDecimal pmHigh = ctx != null ? ctx.getPremarketHigh() : null;
        BigDecimal close = i.getClose();

        if (orbHigh != null && hadBreakoutAbove(sessionToday, orbHigh) && close.compareTo(orbHigh) < 0) {
            return true;
        }
        if (pmHigh != null && hadBreakoutAbove(sessionToday, pmHigh) && close.compareTo(pmHigh) < 0) {
            return true;
        }
        return false;
    }

    private boolean hadBreakoutAbove(List<Candle> sessionToday, BigDecimal level) {
        for (Candle c : sessionToday) {
            if (c.getHigh().compareTo(level) > 0 || c.getClose().compareTo(level) > 0) {
                return true;
            }
        }
        return false;
    }

    private boolean isBearishMomentumShift(IndicatorResult i) {
        if (i.getMacd().compareTo(i.getSignalLine()) < 0) {
            return true;
        }
        return i.getRsi().compareTo(BigDecimal.valueOf(50)) < 0;
    }

    private boolean isHighSellVolume(IndicatorResult i) {
        if (i.getClose().compareTo(i.getOpen()) >= 0) return false;
        if (i.getAvgVolume() == null || i.getAvgVolume() <= 0) return false;
        long threshold = SELL_VOLUME_MULT.multiply(BigDecimal.valueOf(i.getAvgVolume())).longValue();
        return i.getVolume() != null && i.getVolume() > threshold;
    }

    private boolean isFailedFollowThrough(List<Candle> sessionToday, Candle current) {
        if (sessionToday.size() < 2 || current == null) return false;
        int idx = indexOf(sessionToday, current);
        if (idx <= 0) return false;
        Candle prior = sessionToday.get(idx - 1);
        boolean priorGreen = prior.getClose().compareTo(prior.getOpen()) > 0;
        boolean currentRed = current.getClose().compareTo(current.getOpen()) < 0;
        return priorGreen && currentRed;
    }

    private boolean isLowerHighs(List<Candle> sessionToday) {
        if (sessionToday.size() < 3) return false;
        int from = Math.max(0, sessionToday.size() - 3);
        List<Candle> recent = sessionToday.subList(from, sessionToday.size());
        return recent.get(0).getHigh().compareTo(recent.get(1).getHigh()) > 0
                && recent.get(1).getHigh().compareTo(recent.get(2).getHigh()) > 0;
    }

    private int indexOf(List<Candle> sessionToday, Candle current) {
        for (int j = 0; j < sessionToday.size(); j++) {
            if (sessionToday.get(j).getOpenTime().equals(current.getOpenTime())) {
                return j;
            }
        }
        return -1;
    }

    private List<Candle> sessionCandlesToday(List<Candle> candles, Candle current) {
        if (candles == null) return List.of();
        LocalDate sessionDay = current != null
                ? MarketTime.toMarketZoned(current.getOpenTime()).toLocalDate()
                : MarketTime.now().toLocalDate();
        return candles.stream()
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .filter(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(sessionDay))
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
    }
}
