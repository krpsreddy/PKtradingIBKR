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
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class MomentumPullbackEvaluator {

    public static final String READINESS_PULL_READY = "PULL_READY";
    public static final String READINESS_MOM_READY = "MOM_READY";

    private static final BigDecimal CLOSE_NEAR_HIGH = BigDecimal.valueOf(0.65);
    private static final BigDecimal SESSION_HIGH_TOLERANCE = BigDecimal.valueOf(0.003);
    private static final BigDecimal MAX_VWAP_DIST = BigDecimal.valueOf(0.05);
    private static final BigDecimal MAX_EMA9_DIST = BigDecimal.valueOf(0.04);

    private static final LocalTime MIDDAY_START = LocalTime.of(11, 30);
    private static final LocalTime MIDDAY_END = LocalTime.of(13, 30);
    private static final LocalTime LATE_DAY_START = LocalTime.of(15, 0);

    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;

    public MomentumPullbackEvaluator(MarketHoursService marketHoursService, TradingProperties tradingProperties) {
        this.marketHoursService = marketHoursService;
        this.tradingProperties = tradingProperties;
    }

    @Value
    public static class MomPullEvaluation {
        // shared
        boolean fullTrendStack;
        boolean notBearishStack;
        boolean aboveVwap;
        boolean chopBox;
        int requiredConfidence;
        // pull
        boolean priorImpulse;
        boolean pullbackSequence;
        boolean vwapHold;
        boolean bounceQuality;
        boolean pullRvolOk;
        // mom
        boolean notExtended;
        boolean breakoutTrigger;
        boolean macdAccelerating;
        boolean momRvolOk;
        boolean rsiStrong;
        boolean aboveSessionOpen;
        boolean recentBullishImpulse;
        int pullConfidence;
        int momConfidence;
        String sessionLabel;

        public boolean isPullReady() {
            return fullTrendStack && notBearishStack && priorImpulse && pullbackSequence
                    && vwapHold && aboveVwap && !chopBox && !bounceQuality
                    && pullConfidence >= requiredConfidence;
        }

        public boolean isPullBuy() {
            return fullTrendStack && notBearishStack && priorImpulse && pullbackSequence
                    && vwapHold && bounceQuality && pullRvolOk && aboveVwap && !chopBox
                    && pullConfidence >= requiredConfidence;
        }

        public boolean isMomReady() {
            return fullTrendStack && notBearishStack && notExtended && macdAccelerating
                    && momRvolOk && aboveVwap && !chopBox && !breakoutTrigger;
        }

        public boolean isMomBuy() {
            return fullTrendStack && notBearishStack && notExtended && breakoutTrigger
                    && macdAccelerating && momRvolOk && rsiStrong && aboveVwap && !chopBox
                    && aboveSessionOpen && recentBullishImpulse
                    && momConfidence >= requiredConfidence;
        }

        public String pullReadinessState() {
            return isPullReady() ? READINESS_PULL_READY : "";
        }

        public String momReadinessState() {
            return isMomReady() ? READINESS_MOM_READY : "";
        }
    }

    public MomPullEvaluation evaluate(IndicatorResult i) {
        List<Candle> candles = sessionCandles(i);
        ZonedDateTime barTime = barTime(i);
        int required = requiredConfidence(barTime);

        boolean fullStack = hasFullTrendStack(i);
        boolean notBearish = !hasBearishStack(i);
        boolean chop = isChopBox(candles, i);
        boolean aboveVwap = i.getClose().compareTo(i.getVwap()) > 0;

        boolean priorImpulse = hasPriorImpulse(candles, i);
        boolean pullbackSeq = hasPullbackSequence(candles);
        boolean vwapHold = pullbackHeldVwap(candles, i);
        boolean bounce = hasBounceQuality(i);
        boolean pullRvol = rvolAtLeast(i, BigDecimal.valueOf(tradingProperties.getMomPullMinRvolPull()));

        boolean notExt = !isTooExtended(i);
        boolean breakout = isBreakoutTrigger(candles, i);
        boolean macdAccel = isMacdAccelerating(i);
        boolean momRvol = rvolAtLeast(i, BigDecimal.valueOf(tradingProperties.getMomPullMinRvolMom()));
        boolean rsiOk = i.getRsi().compareTo(BigDecimal.valueOf(55)) > 0;
        BigDecimal sessionOpen = sessionOpenPrice(candles, i.getCurrentCandle());
        boolean aboveOpen = sessionOpen != null && i.getClose().compareTo(sessionOpen) > 0;
        boolean recentImpulse = hasRecentBullishImpulse(candles);

        int pullConf = scorePull(fullStack, priorImpulse, pullbackSeq, vwapHold, aboveVwap, bounce, pullRvol, chop);
        int momConf = scoreMom(fullStack, notExt, breakout, macdAccel, momRvol, rsiOk, aboveVwap, chop);

        return new MomPullEvaluation(
                fullStack, notBearish, aboveVwap, chop, required,
                priorImpulse, pullbackSeq, vwapHold, bounce, pullRvol,
                notExt, breakout, macdAccel, momRvol, rsiOk, aboveOpen, recentImpulse,
                pullConf, momConf, sessionLabel(barTime)
        );
    }

    private int scorePull(boolean fullStack, boolean priorImpulse, boolean pullbackSeq,
                          boolean vwapHold, boolean aboveVwap, boolean bounce,
                          boolean pullRvol, boolean chop) {
        int score = 0;
        if (fullStack) score++;
        if (priorImpulse) score++;
        if (pullbackSeq) score++;
        if (vwapHold) score++;
        if (aboveVwap) score++;
        if (bounce) score++;
        if (pullRvol) score++;
        if (!chop) score++;
        return score;
    }

    private int scoreMom(boolean fullStack, boolean notExt, boolean breakout, boolean macdAccel,
                         boolean momRvol, boolean rsiOk, boolean aboveVwap, boolean chop) {
        int score = 0;
        if (fullStack) score++;
        if (notExt) score++;
        if (breakout) score++;
        if (macdAccel) score++;
        if (momRvol) score++;
        if (rsiOk) score++;
        if (aboveVwap) score++;
        if (!chop) score++;
        return score;
    }

    public boolean shouldExit(IndicatorResult i, int barsSinceEntry) {
        if (barsSinceEntry < tradingProperties.getMomPullMinHoldBars()) {
            return false;
        }
        return countExitSignals(i) >= tradingProperties.getMomPullExitMinSignals();
    }

    public int countExitSignals(IndicatorResult i) {
        int count = 0;
        if (crossedBelow(i.getPreviousEma9(), i.getPreviousEma20(), i.getEma9(), i.getEma20())) {
            count++;
        }
        if (crossedBelow(i.getPreviousMacd(), i.getPreviousSignalLine(), i.getMacd(), i.getSignalLine())) {
            count++;
        }
        if (i.getClose().compareTo(i.getVwap()) < 0) {
            count++;
        }
        return count;
    }

    public List<String> buildExitReasons(IndicatorResult i) {
        List<String> reasons = new ArrayList<>();
        if (crossedBelow(i.getPreviousEma9(), i.getPreviousEma20(), i.getEma9(), i.getEma20())) {
            reasons.add("EMA Bearish");
        }
        if (crossedBelow(i.getPreviousMacd(), i.getPreviousSignalLine(), i.getMacd(), i.getSignalLine())) {
            reasons.add("MACD Bearish");
        }
        if (i.getClose().compareTo(i.getVwap()) < 0) {
            reasons.add("Below VWAP");
        }
        if (reasons.isEmpty()) {
            reasons.add("Momentum Exit");
        }
        return reasons;
    }

    public int calculatePullConfidence(IndicatorResult i, List<Candle> candles) {
        return evaluate(i).pullConfidence;
    }

    public int calculateMomConfidence(IndicatorResult i, List<Candle> candles) {
        return evaluate(i).momConfidence;
    }

    /** Legacy confidence used for chip display on fired signals. */
    public int calculateDisplayConfidence(IndicatorResult i) {
        int score = 0;
        if (i.getClose().compareTo(i.getVwap()) > 0) score++;
        if (i.getEma9().compareTo(i.getEma20()) > 0) score++;
        if (i.getEma20().compareTo(i.getEma50()) > 0) score++;
        if (i.getRsi().compareTo(BigDecimal.valueOf(60)) > 0) score++;
        if (rvolAtLeast(i, BigDecimal.valueOf(1.5))) score++;
        if (hasStrongBody(i)) score++;
        return score;
    }

    public String confidenceLabel(int score) {
        if (score >= 6) return "ELITE";
        if (score >= 4) return "STRONG";
        if (score >= 2) return "GOOD";
        return "WEAK";
    }

    public List<String> buildPullReasonChips(MomPullEvaluation eval) {
        List<String> chips = new ArrayList<>();
        if (eval.priorImpulse) chips.add("Prior Impulse");
        if (eval.pullbackSequence) chips.add("Pullback Sequence");
        if (eval.vwapHold) chips.add("VWAP Hold");
        if (eval.bounceQuality) chips.add("Bounce Quality");
        if (eval.pullRvolOk) chips.add("RVOL Confirm");
        if (eval.fullTrendStack) chips.add("EMA Stack");
        if (eval.aboveVwap) chips.add("Above VWAP");
        if (!eval.chopBox) chips.add("Not Chop");
        chips.add(0, "Pullback Entry");
        return chips;
    }

    public List<String> buildMomReasonChips(MomPullEvaluation eval) {
        List<String> chips = new ArrayList<>();
        if (eval.breakoutTrigger) chips.add("Breakout");
        if (eval.macdAccelerating) chips.add("MACD Accel");
        if (eval.momRvolOk) chips.add("High RVOL");
        if (eval.fullTrendStack) chips.add("EMA Stack");
        if (eval.notExtended) chips.add("Not Extended");
        if (eval.aboveVwap) chips.add("Above VWAP");
        if (eval.rsiStrong) chips.add("RSI Strong");
        if (eval.aboveSessionOpen) chips.add("Above Session Open");
        if (eval.recentBullishImpulse) chips.add("Bullish Impulse");
        return chips;
    }

    public List<String> buildFailedConditions(MomPullEvaluation eval, boolean forPull) {
        List<String> failed = new ArrayList<>();
        if (!eval.fullTrendStack) failed.add("EMA stack incomplete");
        if (!eval.notBearishStack) failed.add("Bearish symbol trend");
        if (!eval.aboveVwap) failed.add("Below VWAP");
        if (eval.chopBox) failed.add("Chop box detected");
        if (forPull) {
            if (eval.pullConfidence < eval.requiredConfidence) failed.add("Confidence too low");
            if (!eval.priorImpulse) failed.add("No prior impulse");
            if (!eval.pullbackSequence) failed.add("No pullback sequence");
            if (!eval.vwapHold) failed.add("Lost VWAP on pullback");
            if (!eval.bounceQuality) failed.add("Weak bounce");
            if (!eval.pullRvolOk) failed.add("RVOL too low");
        } else {
            if (!eval.notExtended) failed.add("Too extended");
            if (!eval.breakoutTrigger) failed.add("No breakout");
            if (!eval.macdAccelerating) failed.add("MACD not accelerating");
            if (!eval.momRvolOk) failed.add("RVOL too low");
            if (!eval.rsiStrong) failed.add("RSI weak");
            if (!eval.aboveSessionOpen) failed.add("Below session open");
            if (!eval.recentBullishImpulse) failed.add("No recent bullish impulse");
            if (eval.momConfidence < eval.requiredConfidence) failed.add("Confidence too low");
        }
        return failed;
    }

    public Map<String, Boolean> toPullDebugMap(MomPullEvaluation eval) {
        Map<String, Boolean> m = new LinkedHashMap<>();
        m.put("fullTrendStack", eval.fullTrendStack);
        m.put("notBearishStack", eval.notBearishStack);
        m.put("priorImpulse", eval.priorImpulse);
        m.put("pullbackSequence", eval.pullbackSequence);
        m.put("vwapHold", eval.vwapHold);
        m.put("bounceQuality", eval.bounceQuality);
        m.put("pullRvolOk", eval.pullRvolOk);
        m.put("aboveVwap", eval.aboveVwap);
        m.put("notChop", !eval.chopBox);
        m.put("pullConfidenceMet", eval.pullConfidence >= eval.requiredConfidence);
        m.put("pullReady", eval.isPullReady());
        m.put("pullBuy", eval.isPullBuy());
        return m;
    }

    public Map<String, Boolean> toMomDebugMap(MomPullEvaluation eval) {
        Map<String, Boolean> m = new LinkedHashMap<>();
        m.put("fullTrendStack", eval.fullTrendStack);
        m.put("notBearishStack", eval.notBearishStack);
        m.put("notExtended", eval.notExtended);
        m.put("breakoutTrigger", eval.breakoutTrigger);
        m.put("macdAccelerating", eval.macdAccelerating);
        m.put("momRvolOk", eval.momRvolOk);
        m.put("rsiStrong", eval.rsiStrong);
        m.put("aboveVwap", eval.aboveVwap);
        m.put("aboveSessionOpen", eval.aboveSessionOpen);
        m.put("recentBullishImpulse", eval.recentBullishImpulse);
        m.put("notChop", !eval.chopBox);
        m.put("momConfidenceMet", eval.momConfidence >= eval.requiredConfidence);
        m.put("momReady", eval.isMomReady());
        m.put("momBuy", eval.isMomBuy());
        return m;
    }

    private int requiredConfidence(ZonedDateTime barTime) {
        if (barTime == null) {
            return tradingProperties.getMomPullMinConfidence();
        }
        LocalTime t = barTime.toLocalTime();
        if (!t.isBefore(MIDDAY_START) && t.isBefore(MIDDAY_END)) {
            return tradingProperties.getMomPullMiddayMinConfidence();
        }
        if (!t.isBefore(LATE_DAY_START)) {
            return tradingProperties.getMomPullLateDayMinConfidence();
        }
        return tradingProperties.getMomPullMinConfidence();
    }

    private String sessionLabel(ZonedDateTime barTime) {
        if (barTime == null) return "REGULAR";
        LocalTime t = barTime.toLocalTime();
        if (!t.isBefore(MIDDAY_START) && t.isBefore(MIDDAY_END)) return "MIDDAY";
        if (!t.isBefore(LATE_DAY_START)) return "LATE_DAY";
        return "REGULAR";
    }

    private boolean hasFullTrendStack(IndicatorResult i) {
        return i.getEma9().compareTo(i.getEma20()) > 0
                && i.getEma20().compareTo(i.getEma50()) > 0;
    }

    private boolean hasBearishStack(IndicatorResult i) {
        return i.getEma9().compareTo(i.getEma20()) < 0
                && i.getEma20().compareTo(i.getEma50()) < 0;
    }

    private boolean hasPriorImpulse(List<Candle> candles, IndicatorResult i) {
        if (candles.size() < 3 || i.getEma20().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal threshold = BigDecimal.valueOf(tradingProperties.getMomPullPriorImpulsePct());
        int lookback = Math.min(tradingProperties.getMomPullImpulseLookbackBars(), candles.size() - 1);
        int start = Math.max(0, candles.size() - 1 - lookback);
        for (int idx = start; idx < candles.size() - 1; idx++) {
            Candle c = candles.get(idx);
            BigDecimal dist = c.getHigh().subtract(i.getEma20())
                    .divide(i.getEma20(), 4, RoundingMode.HALF_UP);
            if (dist.compareTo(threshold) >= 0) {
                return true;
            }
        }
        return false;
    }

    private boolean hasPullbackSequence(List<Candle> candles) {
        if (candles.size() < 4) {
            return false;
        }
        int start = Math.max(1, candles.size() - 4);
        int redOrLower = 0;
        for (int idx = start; idx < candles.size() - 1; idx++) {
            Candle c = candles.get(idx);
            Candle prev = candles.get(idx - 1);
            boolean red = c.getClose().compareTo(c.getOpen()) < 0;
            boolean lowerHigh = c.getHigh().compareTo(prev.getHigh()) < 0;
            if (red || lowerHigh) {
                redOrLower++;
            }
        }
        return redOrLower >= 2;
    }

    private boolean pullbackHeldVwap(List<Candle> candles, IndicatorResult i) {
        if (candles.size() < 3 || i.getVwap().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        for (int idx = candles.size() - 3; idx < candles.size() - 1; idx++) {
            if (candles.get(idx).getLow().compareTo(i.getVwap()) < 0) {
                return false;
            }
        }
        return true;
    }

    private boolean hasBounceQuality(IndicatorResult i) {
        if (i.getPreviousClose() == null) {
            return false;
        }
        boolean bullishReversal = i.getClose().compareTo(i.getOpen()) > 0
                && i.getClose().compareTo(i.getPreviousClose()) > 0;
        if (!bullishReversal) {
            return false;
        }
        BigDecimal range = i.getHigh().subtract(i.getLow());
        if (range.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal closePos = i.getClose().subtract(i.getLow()).divide(range, 4, RoundingMode.HALF_UP);
        return closePos.compareTo(CLOSE_NEAR_HIGH) >= 0;
    }

    private boolean isBreakoutTrigger(List<Candle> candles, IndicatorResult i) {
        if (candles.size() < 4) {
            return false;
        }
        int end = candles.size() - 2;
        int start = Math.max(0, end - 2);
        BigDecimal priorHigh = null;
        for (int idx = start; idx <= end; idx++) {
            priorHigh = priorHigh == null ? candles.get(idx).getHigh() : priorHigh.max(candles.get(idx).getHigh());
        }
        if (priorHigh != null && i.getClose().compareTo(priorHigh) >= 0) {
            return true;
        }
        BigDecimal sessionHigh = candles.stream().map(Candle::getHigh).max(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
        if (sessionHigh.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal dist = sessionHigh.subtract(i.getClose()).abs()
                .divide(sessionHigh, 4, RoundingMode.HALF_UP);
        return dist.compareTo(SESSION_HIGH_TOLERANCE) <= 0;
    }

    private boolean isMacdAccelerating(IndicatorResult i) {
        if (i.getMacd().compareTo(i.getSignalLine()) <= 0) {
            return false;
        }
        if (i.getPreviousMacd() == null) {
            return true;
        }
        return i.getMacd().compareTo(i.getPreviousMacd()) > 0;
    }

    private boolean isTooExtended(IndicatorResult i) {
        if (i.getVwap().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal vwapDist = i.getClose().subtract(i.getVwap()).abs()
                    .divide(i.getVwap(), 4, RoundingMode.HALF_UP);
            if (vwapDist.compareTo(MAX_VWAP_DIST) > 0) {
                return true;
            }
        }
        if (i.getEma9().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal emaDist = i.getClose().subtract(i.getEma9()).abs()
                    .divide(i.getEma9(), 4, RoundingMode.HALF_UP);
            if (emaDist.compareTo(MAX_EMA9_DIST) > 0) {
                return true;
            }
        }
        if (i.getRsi().compareTo(BigDecimal.valueOf(75)) > 0) {
            return true;
        }
        return false;
    }

    private boolean isChopBox(List<Candle> candles, IndicatorResult i) {
        if (candles.size() < 6 || i.getClose().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        int end = candles.size() - 1;
        int start = Math.max(0, end - 5);
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
        BigDecimal rangePct = maxHigh.subtract(minLow).divide(i.getClose(), 4, RoundingMode.HALF_UP);
        return rangePct.compareTo(BigDecimal.valueOf(tradingProperties.getMomPullChopRangePct())) < 0;
    }

    private boolean hasRecentBullishImpulse(List<Candle> candles) {
        if (candles.size() < 2) {
            return false;
        }
        int lookback = tradingProperties.getMomPullMomImpulseLookbackBars();
        int end = candles.size() - 2;
        int start = Math.max(0, end - lookback + 1);
        BigDecimal minBody = BigDecimal.valueOf(tradingProperties.getMomPullMomImpulseMinBodyPct());
        for (int idx = start; idx <= end; idx++) {
            Candle c = candles.get(idx);
            if (c.getClose().compareTo(c.getOpen()) <= 0) {
                continue;
            }
            BigDecimal range = c.getHigh().subtract(c.getLow());
            if (range.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            BigDecimal body = c.getClose().subtract(c.getOpen());
            if (body.divide(c.getClose(), 4, RoundingMode.HALF_UP).compareTo(minBody) >= 0) {
                return true;
            }
        }
        return false;
    }

    private BigDecimal sessionOpenPrice(List<Candle> candles, Candle current) {
        if (candles.isEmpty() || current == null) {
            return null;
        }
        var sessionDay = MarketTime.toMarketZoned(current.getOpenTime()).toLocalDate();
        for (Candle c : candles) {
            if (MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(sessionDay)) {
                return c.getOpen();
            }
        }
        return candles.get(0).getOpen();
    }

    private boolean rvolAtLeast(IndicatorResult i, BigDecimal min) {
        return i.getRelativeVolume() != null && i.getRelativeVolume().compareTo(min) >= 0;
    }

    private boolean hasStrongBody(IndicatorResult i) {
        BigDecimal range = i.getHigh().subtract(i.getLow());
        if (range.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal body = i.getClose().subtract(i.getOpen()).abs();
        return body.divide(range, 2, RoundingMode.HALF_UP).compareTo(BigDecimal.valueOf(0.6)) >= 0;
    }

    private boolean crossedBelow(BigDecimal prevA, BigDecimal prevB, BigDecimal currA, BigDecimal currB) {
        if (prevA == null || prevB == null || currA == null || currB == null) {
            return false;
        }
        return prevA.compareTo(prevB) >= 0 && currA.compareTo(currB) < 0;
    }

    private List<Candle> sessionCandles(IndicatorResult i) {
        if (i.getRecentCandles() == null || i.getCurrentCandle() == null) {
            return List.of();
        }
        var sessionDay = MarketTime.toMarketZoned(i.getCurrentCandle().getOpenTime()).toLocalDate();
        return i.getRecentCandles().stream()
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .filter(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(sessionDay))
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
    }

    private ZonedDateTime barTime(IndicatorResult i) {
        if (i.getCurrentCandle() == null) {
            return null;
        }
        return MarketTime.toMarketZoned(i.getCurrentCandle().getOpenTime());
    }
}
