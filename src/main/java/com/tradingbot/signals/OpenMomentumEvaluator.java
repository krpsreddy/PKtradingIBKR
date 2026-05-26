package com.tradingbot.signals;

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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class OpenMomentumEvaluator {

    public static final String READINESS_OPEN_READY = "OPEN_READY";

    private static final BigDecimal RVOL_THRESHOLD = BigDecimal.valueOf(3.0);
    private static final BigDecimal VOLUME_MULT = BigDecimal.valueOf(3.0);
    private static final BigDecimal BODY_RATIO = BigDecimal.valueOf(0.65);
    private static final BigDecimal CLOSE_NEAR_HIGH = BigDecimal.valueOf(0.75);
    private static final BigDecimal GAP_PREFERRED = BigDecimal.valueOf(0.02);
    private static final BigDecimal MAX_VWAP_DIST = BigDecimal.valueOf(0.05);
    private static final BigDecimal MAX_EMA9_DIST = BigDecimal.valueOf(0.04);

    private final MarketHoursService marketHoursService;

    public OpenMomentumEvaluator(MarketHoursService marketHoursService) {
        this.marketHoursService = marketHoursService;
    }

    @Value
    public static class OpenEvaluation {
        boolean massiveVolume;
        boolean strongBody;
        boolean closeNearHigh;
        boolean gapStrength;
        boolean aboveVwap;
        boolean orbBreakout;
        boolean followThrough;
        boolean notExtended;
        boolean volumeFiltersPassed;
        Double gapPercent;

        public boolean isOpenMomBuy() {
            return volumeFiltersPassed && massiveVolume && strongBody && closeNearHigh
                    && aboveVwap && orbBreakout && followThrough && notExtended;
        }

        public boolean isOpenReady() {
            return volumeFiltersPassed && massiveVolume && strongBody && aboveVwap
                    && !orbBreakout;
        }

        public String readinessState() {
            return isOpenReady() ? READINESS_OPEN_READY : "";
        }
    }

    public OpenEvaluation evaluate(IndicatorResult i, SymbolContext ctx, Long avgDailyVolume,
                                   long minBarVolume, long minAvgDailyVolume) {
        List<Candle> sessionToday = sessionCandlesToday(i.getRecentCandles(), i.getCurrentCandle());
        Double gapPct = calculateGapPercent(i.getRecentCandles(), sessionToday);

        boolean volumeFilters = passesVolumeFilters(i, avgDailyVolume, minBarVolume, minAvgDailyVolume);
        boolean massiveVolume = isMassiveVolume(i);
        boolean strongBody = isStrongBody(i);
        boolean closeNearHigh = isCloseNearHigh(i);
        boolean gapStrength = gapPct != null && gapPct >= GAP_PREFERRED.doubleValue() * 100;
        boolean aboveVwap = i.getClose().compareTo(i.getVwap()) > 0;
        BigDecimal orbHigh = ctx != null ? ctx.getOpeningRangeHigh() : null;
        boolean orbBreakout = isOrbBreakout(i, orbHigh, sessionToday);
        boolean followThrough = hasFollowThrough(i, sessionToday);
        boolean notExtended = !isTooExtended(i);

        return new OpenEvaluation(
                massiveVolume, strongBody, closeNearHigh, gapStrength, aboveVwap,
                orbBreakout, followThrough, notExtended, volumeFilters, gapPct
        );
    }

    public int calculateScore(IndicatorResult i, OpenEvaluation eval) {
        int score = 0;
        if (eval.massiveVolume) {
            score++;
            if (i.getRelativeVolume() != null
                    && i.getRelativeVolume().compareTo(BigDecimal.valueOf(4)) > 0) {
                score++;
            }
        }
        if (eval.strongBody) {
            score++;
        }
        if (eval.closeNearHigh) {
            score++;
        }
        if (eval.aboveVwap) {
            score++;
        }
        if (eval.orbBreakout) {
            score++;
        }
        if (eval.followThrough) {
            score++;
        }
        return Math.min(score, 7);
    }

    public String scoreLabel(int score) {
        if (score >= 6) {
            return "ELITE OPEN MOM";
        }
        if (score >= 4) {
            return "STRONG OPEN MOM";
        }
        if (score >= 2) {
            return "GOOD OPEN MOM";
        }
        return "WEAK";
    }

    public List<String> buildReasonChips(OpenEvaluation eval) {
        List<String> chips = new ArrayList<>();
        if (eval.massiveVolume) {
            chips.add("Massive Opening Volume");
        }
        if (eval.strongBody) {
            chips.add("Strong Opening Body");
        }
        if (eval.closeNearHigh) {
            chips.add("Close Near High");
        }
        if (eval.gapStrength) {
            chips.add("Gap Strength");
        }
        if (eval.aboveVwap) {
            chips.add("Above VWAP");
        }
        if (eval.orbBreakout) {
            chips.add("Opening Range Breakout");
        }
        if (eval.followThrough) {
            chips.add("Follow-Through");
        }
        return chips;
    }

    public Map<String, Boolean> toDebugMap(OpenEvaluation eval) {
        Map<String, Boolean> map = new LinkedHashMap<>();
        map.put("volumeFiltersPassed", eval.volumeFiltersPassed);
        map.put("massiveVolume", eval.massiveVolume);
        map.put("strongBody", eval.strongBody);
        map.put("closeNearHigh", eval.closeNearHigh);
        map.put("gapStrength", eval.gapStrength);
        map.put("aboveVwap", eval.aboveVwap);
        map.put("orbBreakout", eval.orbBreakout);
        map.put("followThrough", eval.followThrough);
        map.put("notExtended", eval.notExtended);
        map.put("openMomBuy", eval.isOpenMomBuy());
        map.put("openReady", eval.isOpenReady());
        return map;
    }

    private boolean passesVolumeFilters(IndicatorResult i, Long avgDailyVolume,
                                        long minBarVolume, long minAvgDailyVolume) {
        long vol = i.getVolume() != null ? i.getVolume() : 0L;
        if (vol < minBarVolume) {
            return false;
        }
        if (avgDailyVolume != null && avgDailyVolume > 0 && avgDailyVolume < minAvgDailyVolume) {
            return false;
        }
        return true;
    }

    private boolean isMassiveVolume(IndicatorResult i) {
        if (i.getRelativeVolume() != null && i.getRelativeVolume().compareTo(RVOL_THRESHOLD) > 0) {
            return true;
        }
        if (i.getAvgVolume() == null || i.getAvgVolume() <= 0) {
            return false;
        }
        long threshold = VOLUME_MULT.multiply(BigDecimal.valueOf(i.getAvgVolume())).longValue();
        return i.getVolume() != null && i.getVolume() > threshold;
    }

    private boolean isStrongBody(IndicatorResult i) {
        BigDecimal range = i.getHigh().subtract(i.getLow());
        if (range.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal body = i.getClose().subtract(i.getOpen()).abs();
        return body.divide(range, 2, RoundingMode.HALF_UP).compareTo(BODY_RATIO) > 0;
    }

    private boolean isCloseNearHigh(IndicatorResult i) {
        BigDecimal range = i.getHigh().subtract(i.getLow());
        if (range.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        BigDecimal closePosition = i.getClose().subtract(i.getLow()).divide(range, 4, RoundingMode.HALF_UP);
        return closePosition.compareTo(CLOSE_NEAR_HIGH) > 0;
    }

    private boolean isOrbBreakout(IndicatorResult i, BigDecimal openingRangeHigh, List<Candle> sessionToday) {
        if (openingRangeHigh != null && i.getClose().compareTo(openingRangeHigh) > 0) {
            return true;
        }
        if (sessionToday.size() >= 2) {
            Candle first = sessionToday.get(0);
            Candle second = sessionToday.get(1);
            if (i.getCurrentCandle() != null
                    && i.getCurrentCandle().getOpenTime().equals(second.getOpenTime())) {
                return second.getClose().compareTo(first.getHigh()) > 0;
            }
        }
        return false;
    }

    private boolean hasFollowThrough(IndicatorResult i, List<Candle> sessionToday) {
        if (sessionToday.size() < 2) {
            return i.getClose().compareTo(i.getOpen()) > 0;
        }
        Candle current = i.getCurrentCandle();
        if (current == null) {
            return false;
        }
        int idx = -1;
        for (int j = 0; j < sessionToday.size(); j++) {
            if (sessionToday.get(j).getOpenTime().equals(current.getOpenTime())) {
                idx = j;
                break;
            }
        }
        if (idx <= 0) {
            return current.getClose().compareTo(current.getOpen()) > 0;
        }
        Candle prior = sessionToday.get(idx - 1);
        boolean priorGreen = prior.getClose().compareTo(prior.getOpen()) > 0;
        boolean currentGreen = current.getClose().compareTo(current.getOpen()) > 0;
        return priorGreen || currentGreen;
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
        return false;
    }

    private Double calculateGapPercent(List<Candle> all, List<Candle> sessionToday) {
        if (sessionToday.isEmpty() || all == null || all.size() < 2) {
            return null;
        }
        Candle openBar = sessionToday.get(0);
        Candle prior = all.stream()
                .filter(c -> c.getOpenTime().isBefore(openBar.getOpenTime()))
                .max(Comparator.comparing(Candle::getOpenTime))
                .orElse(null);
        if (prior == null || prior.getClose().compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        return openBar.getOpen().subtract(prior.getClose())
                .divide(prior.getClose(), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .doubleValue();
    }

    private List<Candle> sessionCandlesToday(List<Candle> candles, Candle current) {
        if (candles == null) {
            return List.of();
        }
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
