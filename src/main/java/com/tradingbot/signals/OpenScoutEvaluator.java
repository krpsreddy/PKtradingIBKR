package com.tradingbot.signals;

import com.tradingbot.candle.LiveCandleSnapshot;
import com.tradingbot.models.Candle;
import com.tradingbot.symbol.SymbolContext;
import lombok.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class OpenScoutEvaluator {

    /**
     * Future extension points (not implemented): Level 2 depth, order-flow imbalance,
     * bid/ask imbalance, tape speed, relative sector strength.
     */
    public static final String SCOUT_FAILED = "OPEN_SCOUT_FAILED";
    public static final int MAX_SCORE = 4;

    private static final BigDecimal ESTIMATED_RVOL_THRESHOLD = BigDecimal.valueOf(3.0);
    private static final BigDecimal PRICE_EXPANSION_PCT = BigDecimal.valueOf(0.015);
    private static final BigDecimal BODY_RATIO = BigDecimal.valueOf(0.55);
    private static final BigDecimal NEAR_HIGH_RATIO = BigDecimal.valueOf(0.70);
    private static final BigDecimal REJECTION_RATIO = BigDecimal.valueOf(0.45);

    @Value
    public static class ScoutEvaluation {
        boolean rapidVolume;
        boolean rapidExpansion;
        boolean strongBody;
        boolean nearHighs;
        boolean aboveVwap;
        boolean premarketBreakout;
        boolean orbBreakout;
        boolean openingBreakout;
        boolean liquidityOk;
        Double estimatedRvol;
        Double gapPercent;
        Double liveBodyStrength;
        Double nearHighPosition;

        public boolean isOpenScout() {
            return liquidityOk && rapidVolume && rapidExpansion && strongBody
                    && nearHighs && aboveVwap && openingBreakout;
        }

        public boolean isScoutReadyForOpenReady() {
            return liquidityOk && rapidVolume && aboveVwap && !premarketBreakout;
        }

        public boolean isFailed(double price, BigDecimal liveVwap, LiveCandleSnapshot snap) {
            if (liveVwap != null && BigDecimal.valueOf(price).compareTo(liveVwap) < 0) {
                return true;
            }
            if (snap != null && nearHighPosition != null && nearHighPosition < REJECTION_RATIO.doubleValue()) {
                return true;
            }
            return false;
        }
    }

    public ScoutEvaluation evaluate(LiveCandleSnapshot snap, SymbolContext ctx,
                                    BigDecimal liveVwap, BigDecimal sessionOpenPrice,
                                    long avgBarVolume, Double gapPercent) {
        double price = snap.close().doubleValue();
        boolean liquidityOk = passesLiquidity(price, snap.volume(), ctx);
        double estimatedRvol = estimateRvol(snap.volume(), avgBarVolume, snap.openTime());
        boolean rapidVolume = estimatedRvol >= ESTIMATED_RVOL_THRESHOLD.doubleValue()
                || (avgBarVolume > 0 && snap.volume() > avgBarVolume * 2);

        boolean rapidExpansion = false;
        if (sessionOpenPrice != null && sessionOpenPrice.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal expansion = snap.close().subtract(sessionOpenPrice).abs()
                    .divide(sessionOpenPrice, 4, RoundingMode.HALF_UP);
            rapidExpansion = expansion.compareTo(PRICE_EXPANSION_PCT) > 0;
        }

        double bodyStrength = liveBodyStrength(snap);
        boolean strongBody = bodyStrength > BODY_RATIO.doubleValue();
        double nearHigh = nearHighPosition(snap);
        boolean nearHighs = nearHigh > NEAR_HIGH_RATIO.doubleValue();
        boolean aboveVwap = liveVwap != null && snap.close().compareTo(liveVwap) > 0;

        BigDecimal pmHigh = ctx != null ? ctx.getPremarketHigh() : null;
        boolean premarketBreakout = pmHigh != null && snap.close().compareTo(pmHigh) > 0;
        BigDecimal orbHigh = ctx != null ? ctx.getOpeningRangeHigh() : null;
        boolean orbBreakout = orbHigh != null && snap.close().compareTo(orbHigh) > 0;
        boolean openingBreakout = premarketBreakout || orbBreakout;
        if (!openingBreakout && rapidExpansion && nearHighs) {
            openingBreakout = true;
        }

        return new ScoutEvaluation(
                rapidVolume, rapidExpansion, strongBody, nearHighs, aboveVwap,
                premarketBreakout, orbBreakout, openingBreakout,
                liquidityOk, estimatedRvol, gapPercent, bodyStrength, nearHigh
        );
    }

    public int calculateScore(ScoutEvaluation eval) {
        int score = 0;
        if (eval.rapidVolume) {
            score++;
        }
        if (eval.estimatedRvol != null && eval.estimatedRvol >= 4.0) {
            score++;
        }
        if (eval.strongBody && eval.nearHighs) {
            score++;
        }
        if (eval.premarketBreakout && eval.aboveVwap) {
            score++;
        }
        if (eval.orbBreakout && eval.aboveVwap) {
            score++;
        }
        return Math.min(score, MAX_SCORE);
    }

    public String scoreLabel(int score) {
        if (score >= 4) {
            return "EARLY SIGNAL";
        }
        if (score >= 2) {
            return "SCOUT WATCH";
        }
        return "WEAK SCOUT";
    }

    public List<String> buildReasonChips(ScoutEvaluation eval) {
        List<String> chips = new ArrayList<>();
        if (eval.rapidVolume) {
            chips.add("Rapid Opening Volume");
        }
        if (eval.rapidExpansion) {
            chips.add("Rapid Price Expansion");
        }
        if (eval.strongBody) {
            chips.add("Strong Live Body");
        }
        if (eval.nearHighs) {
            chips.add("Holding Near Highs");
        }
        if (eval.aboveVwap) {
            chips.add("Above VWAP");
        }
        if (eval.premarketBreakout) {
            chips.add("Premarket Breakout");
        }
        if (eval.orbBreakout) {
            chips.add("ORB Breakout");
        }
        return chips;
    }

    public Map<String, Object> toDebugMap(ScoutEvaluation eval) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("liquidityOk", eval.liquidityOk);
        map.put("rapidVolume", eval.rapidVolume);
        map.put("rapidExpansion", eval.rapidExpansion);
        map.put("strongBody", eval.strongBody);
        map.put("nearHighs", eval.nearHighs);
        map.put("aboveVwap", eval.aboveVwap);
        map.put("premarketBreakout", eval.premarketBreakout);
        map.put("orbBreakout", eval.orbBreakout);
        map.put("openingBreakout", eval.openingBreakout);
        map.put("openScout", eval.isOpenScout());
        map.put("estimatedRvol", eval.estimatedRvol);
        map.put("liveBodyStrength", eval.liveBodyStrength);
        map.put("nearHighPosition", eval.nearHighPosition);
        map.put("gapPercent", eval.gapPercent);
        return map;
    }

    private boolean passesLiquidity(double price, long liveVolume, SymbolContext ctx) {
        if (price < 5.0) {
            return false;
        }
        if (liveVolume < 50_000) {
            return false;
        }
        if (ctx != null && ctx.getAvgDailyVolume() != null && ctx.getAvgDailyVolume() < 500_000) {
            return false;
        }
        return true;
    }

    private double estimateRvol(long liveVolume, long avgBarVolume, java.time.LocalDateTime openTime) {
        if (avgBarVolume <= 0) {
            return 0;
        }
        int seconds = openTime.getSecond() + openTime.getMinute() % 5 * 60;
        if (seconds <= 0) {
            seconds = 1;
        }
        double fraction = 300.0 / seconds;
        double projected = liveVolume * fraction;
        return projected / avgBarVolume;
    }

    private double liveBodyStrength(LiveCandleSnapshot snap) {
        BigDecimal range = snap.high().subtract(snap.low());
        if (range.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        BigDecimal body = snap.close().subtract(snap.open()).abs();
        return body.divide(range, 4, RoundingMode.HALF_UP).doubleValue();
    }

    private double nearHighPosition(LiveCandleSnapshot snap) {
        BigDecimal range = snap.high().subtract(snap.low());
        if (range.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        return snap.close().subtract(snap.low()).divide(range, 4, RoundingMode.HALF_UP).doubleValue();
    }
}
