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
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class RecoveryFailEvaluator {

    public static final String READINESS_RECOVERY_FAIL_READY = "RECOVERY_FAIL_READY";
    public static final int MAX_SCORE = 7;

    private static final BigDecimal RETRACE_618 = BigDecimal.valueOf(0.618);
    private static final BigDecimal SELL_VOLUME_MULT = BigDecimal.valueOf(1.3);
    private static final BigDecimal MIN_PRICE = BigDecimal.valueOf(5);

    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;

    public RecoveryFailEvaluator(MarketHoursService marketHoursService, TradingProperties tradingProperties) {
        this.marketHoursService = marketHoursService;
        this.tradingProperties = tradingProperties;
    }

    @Value
    public static class RecoveryEvaluation {
        boolean inWindow;
        boolean liquidityOk;
        boolean sessionBearish;
        boolean meaningfulDrawdown;
        boolean validRally;
        boolean failedReclaim;
        boolean lowerHigh;
        boolean belowVwap;
        boolean bearishMomentum;
        boolean highSellVolume;
        boolean notAtSessionLow;
        boolean recoveryFailSetup;
        boolean recentRallyPeak;
        boolean peakFailureBar;
        double rallyFromLowPct;
        BigDecimal rallyPeak;
        BigDecimal postPeakSwingLow;
        BigDecimal sessionLow;
        BigDecimal sessionOpen;

        public boolean isRecoveryFailSetup() {
            return recoveryFailSetup;
        }

        public boolean isPeakFailureBar() {
            return peakFailureBar;
        }

        public String readinessState() {
            return isRecoveryFailSetup() ? READINESS_RECOVERY_FAIL_READY : "";
        }

        public int calculateScore() {
            int score = 0;
            if (sessionBearish) score++;
            if (meaningfulDrawdown) score++;
            if (validRally) score++;
            if (failedReclaim) score++;
            if (lowerHigh) score++;
            if (belowVwap) score++;
            if (bearishMomentum) score++;
            if (highSellVolume) score++;
            return Math.min(score, MAX_SCORE);
        }
    }

    public RecoveryEvaluation evaluate(IndicatorResult i, Long avgDailyVolume,
                                       long minBarVolume, long minAvgDailyVolume) {
        List<Candle> sessionToday = sessionCandlesToday(i.getRecentCandles(), i.getCurrentCandle());
        Candle current = i.getCurrentCandle();
        ZonedDateTime barTime = current != null ? MarketTime.toMarketZoned(current.getOpenTime()) : null;

        boolean inWindow = marketHoursService.isRecoveryFailWindow(barTime);
        boolean liquidityOk = passesLiquidity(i, avgDailyVolume, minBarVolume, minAvgDailyVolume);
        BigDecimal sessionOpen = sessionOpen(sessionToday);
        BigDecimal sessionLow = sessionLow(sessionToday);
        RallyContext rally = resolveRallyContext(sessionToday, current);
        BigDecimal rallyPeak = rally.peak();
        double rallyPct = rallyFromLowPct(sessionLow, rallyPeak);
        BigDecimal postPeakSwingLow = postPeakSwingLow(sessionToday, rally.peakBarIndex());

        boolean drawdown = hasMeaningfulDrawdown(sessionOpen, sessionLow);
        boolean validRally = rallyPct >= tradingProperties.getRecoveryFailMinRallyPct()
                && rallyPct <= tradingProperties.getRecoveryFailMaxRallyPct();
        boolean recentPeak = rally.recentPeak();
        boolean bearish = isSessionBearish(sessionToday, sessionOpen, i);
        boolean failedReclaim = failedReclaim(i, sessionOpen, sessionLow);
        boolean lowerHigh = isLowerHighVsRally(i, rallyPeak);
        boolean belowVwap = i.getClose().compareTo(i.getVwap()) < 0;
        boolean bearishMom = isBearishMomentum(i);
        boolean sellVol = isHighSellVolume(i);
        boolean notAtLow = !isAtSessionLow(sessionToday, i);
        boolean peakFailure = recentPeak && validRally && lowerHigh && belowVwap
                && (bearishMom || sellVol);

        boolean setup = inWindow && liquidityOk && bearish && drawdown && validRally
                && recentPeak && failedReclaim && peakFailure && notAtLow;

        return new RecoveryEvaluation(
                inWindow, liquidityOk, bearish, drawdown, validRally, failedReclaim,
                lowerHigh, belowVwap, bearishMom, sellVol, notAtLow, setup,
                recentPeak, peakFailure, rallyPct, rallyPeak, postPeakSwingLow,
                sessionLow, sessionOpen
        );
    }

    public BigDecimal confirmationLevel(RecoveryEvaluation eval) {
        if (eval.getPostPeakSwingLow() != null) {
            return eval.getPostPeakSwingLow();
        }
        return null;
    }

    public boolean isConfirmationBar(IndicatorResult i, BigDecimal confirmLevel) {
        if (!isRedCandle(i) || confirmLevel == null) {
            return false;
        }
        if (isAtSessionLow(sessionCandlesToday(i.getRecentCandles(), i.getCurrentCandle()), i)) {
            return false;
        }
        if (!hasConfirmationVolume(i)) {
            return false;
        }
        return i.getClose().compareTo(confirmLevel) < 0;
    }

    /** @deprecated use {@link #isConfirmationBar(IndicatorResult, BigDecimal)} with confirmationLevel */
    public boolean isConfirmationBar(IndicatorResult i, BigDecimal setupBarLow, BigDecimal confirmLevel) {
        BigDecimal level = confirmLevel != null ? confirmLevel : setupBarLow;
        return isConfirmationBar(i, level);
    }

    public String scoreLabel(int score) {
        if (score >= 6) return "ELITE RECOVERY FAIL";
        if (score >= 4) return "STRONG RECOVERY FAIL";
        if (score >= 2) return "WEAK RECOVERY FAIL";
        return "NO RECOVERY FAIL";
    }

    public String putSetupLabel(int score) {
        return score >= 4 ? "PUT SETUP" : "";
    }

    public List<String> buildReasonChips(RecoveryEvaluation eval) {
        List<String> chips = new ArrayList<>();
        if (eval.sessionBearish) chips.add("Bearish Session");
        if (eval.meaningfulDrawdown) chips.add("Morning Selloff");
        if (eval.validRally) chips.add("Dead-Cat Rally");
        if (eval.failedReclaim) chips.add("Failed Reclaim");
        if (eval.lowerHigh) chips.add("Lower High");
        if (eval.belowVwap) chips.add("Below VWAP");
        if (eval.bearishMomentum) chips.add("Bearish Momentum");
        if (eval.highSellVolume) chips.add("Sell Volume");
        if (eval.notAtSessionLow) chips.add("Not At Session Low");
        return chips;
    }

    public Map<String, Boolean> toDebugMap(RecoveryEvaluation eval) {
        Map<String, Boolean> map = new LinkedHashMap<>();
        map.put("inWindow", eval.inWindow);
        map.put("liquidityOk", eval.liquidityOk);
        map.put("sessionBearish", eval.sessionBearish);
        map.put("meaningfulDrawdown", eval.meaningfulDrawdown);
        map.put("validRally", eval.validRally);
        map.put("recentRallyPeak", eval.recentRallyPeak);
        map.put("peakFailureBar", eval.peakFailureBar);
        map.put("failedReclaim", eval.failedReclaim);
        map.put("lowerHigh", eval.lowerHigh);
        map.put("belowVwap", eval.belowVwap);
        map.put("bearishMomentum", eval.bearishMomentum);
        map.put("highSellVolume", eval.highSellVolume);
        map.put("notAtSessionLow", eval.notAtSessionLow);
        map.put("recoveryFailSetup", eval.isRecoveryFailSetup());
        map.put("recoveryFail", eval.isRecoveryFailSetup());
        return map;
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

    private boolean isSessionBearish(List<Candle> sessionToday, BigDecimal sessionOpen, IndicatorResult i) {
        if (sessionOpen == null || sessionToday.size() < tradingProperties.getRecoveryFailBearishBars() + 1) {
            return false;
        }
        if (i.getClose().compareTo(sessionOpen) >= 0 || i.getClose().compareTo(i.getVwap()) >= 0) {
            return false;
        }
        int needed = tradingProperties.getRecoveryFailBearishBars();
        int count = 0;
        for (int idx = sessionToday.size() - needed - 1; idx < sessionToday.size() - 1; idx++) {
            if (idx < 0) {
                continue;
            }
            if (sessionToday.get(idx).getClose().compareTo(sessionOpen) < 0) {
                count++;
            }
        }
        return count >= needed;
    }

    private boolean hasMeaningfulDrawdown(BigDecimal sessionOpen, BigDecimal sessionLow) {
        if (sessionOpen == null || sessionLow == null || sessionOpen.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal drawdown = sessionOpen.subtract(sessionLow)
                .divide(sessionOpen, 4, RoundingMode.HALF_UP);
        return drawdown.compareTo(BigDecimal.valueOf(tradingProperties.getRecoveryFailMinDrawdownPct())) >= 0;
    }

    private double rallyFromLowPct(BigDecimal sessionLow, BigDecimal rallyPeak) {
        if (sessionLow == null || rallyPeak == null || sessionLow.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        return rallyPeak.subtract(sessionLow)
                .divide(sessionLow, 4, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private record RallyContext(BigDecimal peak, int peakBarIndex, boolean recentPeak) {}

    private RallyContext resolveRallyContext(List<Candle> sessionToday, Candle current) {
        if (sessionToday.isEmpty()) {
            return new RallyContext(null, -1, false);
        }
        int maxAge = tradingProperties.getRecoveryFailPeakMaxAgeBars();
        int end = sessionToday.size() - 1;
        int start = Math.max(0, end - tradingProperties.getRecoveryFailRallyLookbackBars());
        BigDecimal peak = null;
        int peakIdx = -1;
        for (int idx = start; idx < end; idx++) {
            Candle c = sessionToday.get(idx);
            if (current != null && c.getOpenTime().equals(current.getOpenTime())) {
                continue;
            }
            if (peak == null || c.getHigh().compareTo(peak) > 0) {
                peak = c.getHigh();
                peakIdx = idx;
            }
        }
        boolean recent = peakIdx >= 0 && (end - peakIdx) <= maxAge;
        return new RallyContext(peak, peakIdx, recent);
    }

    private BigDecimal postPeakSwingLow(List<Candle> sessionToday, int peakBarIndex) {
        if (peakBarIndex < 0 || sessionToday.isEmpty()) {
            return null;
        }
        BigDecimal min = null;
        for (int idx = peakBarIndex; idx < sessionToday.size() - 1; idx++) {
            BigDecimal low = sessionToday.get(idx).getLow();
            min = min == null ? low : min.min(low);
        }
        return min;
    }

    private boolean failedReclaim(IndicatorResult i, BigDecimal sessionOpen, BigDecimal sessionLow) {
        if (sessionOpen == null || sessionLow == null) {
            return false;
        }
        if (i.getClose().compareTo(i.getVwap()) >= 0) {
            return false;
        }
        BigDecimal retrace618 = sessionLow.add(sessionOpen.subtract(sessionLow).multiply(RETRACE_618));
        return i.getClose().compareTo(sessionOpen) < 0 || i.getClose().compareTo(retrace618) < 0;
    }

    private boolean isLowerHighVsRally(IndicatorResult i, BigDecimal rallyPeak) {
        if (rallyPeak == null) {
            return false;
        }
        return i.getHigh().compareTo(rallyPeak) < 0;
    }

    private boolean isBearishMomentum(IndicatorResult i) {
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

    private boolean hasConfirmationVolume(IndicatorResult i) {
        if (i.getAvgVolume() == null || i.getAvgVolume() <= 0) {
            return false;
        }
        long threshold = BigDecimal.valueOf(i.getAvgVolume())
                .multiply(BigDecimal.valueOf(tradingProperties.getRecoveryFailMinRvol()))
                .longValue();
        return i.getVolume() != null && i.getVolume() >= threshold;
    }

    private boolean isRedCandle(IndicatorResult i) {
        return i.getClose().compareTo(i.getOpen()) < 0;
    }

    private boolean isAtSessionLow(List<Candle> sessionToday, IndicatorResult i) {
        if (sessionToday.isEmpty() || i.getClose().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal sessionLow = sessionLow(sessionToday);
        if (sessionLow == null || sessionLow.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal buffer = sessionLow.multiply(
                BigDecimal.ONE.add(BigDecimal.valueOf(tradingProperties.getRecoveryFailSessionLowBuffer())));
        return i.getClose().compareTo(buffer) <= 0;
    }

    private BigDecimal sessionOpen(List<Candle> sessionToday) {
        return sessionToday.isEmpty() ? null : sessionToday.get(0).getOpen();
    }

    private BigDecimal sessionLow(List<Candle> sessionToday) {
        return sessionToday.stream()
                .map(Candle::getLow)
                .min(BigDecimal::compareTo)
                .orElse(null);
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
