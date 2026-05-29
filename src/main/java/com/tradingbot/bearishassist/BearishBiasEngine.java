package com.tradingbot.bearishassist;

import com.tradingbot.marketstructure.MarketEnvironmentState;
import com.tradingbot.marketstructure.MarketStructureAssessment;
import com.tradingbot.symbol.SymbolContext;
import org.springframework.stereotype.Component;

import java.util.Locale;

/** Phase 202 — 0–100 bearish bias score from deterioration / rejection signals. */
@Component
public class BearishBiasEngine {

    public int score(
            SymbolContext ctx,
            int conviction,
            int dominance,
            int persistenceSec,
            int velocity,
            int exhaustion,
            boolean degrading,
            double rvol,
            String regime,
            String velocityTrend,
            MarketStructureAssessment market
    ) {
        int bias = 0;

        if (degrading) bias += 14;
        if (velocity <= -6) bias += 12;
        else if (velocity <= -2) bias += 6;
        if ("DECELERATING".equalsIgnoreCase(velocityTrend) || "FLATTENING".equalsIgnoreCase(velocityTrend)) {
            bias += 8;
        }
        if (persistenceSec < 40) bias += 10;
        else if (persistenceSec < 55) bias += 5;
        if (dominance < 90) bias += 8;
        if (dominance < 70) bias += 10;
        if (conviction < 55) bias += 8;
        if (exhaustion >= 55) bias += 10;
        if (rvol >= 1.8) bias += 6;
        if (rvol < 0.9) bias -= 12;

        if (ctx != null) {
            if (vwapRejected(ctx)) bias += 18;
            if (failedReclaim(ctx)) bias += 14;
            if (lowerHighStructure(ctx)) bias += 10;
        }

        if (regime != null) {
            String r = regime.toUpperCase(Locale.US);
            if (r.contains("FAIL") || r.contains("EXHAUST") || r.contains("DISTRIBUTION")) {
                bias += 16;
            }
            if (r.contains("BREAKOUT") && degrading) {
                bias += 12;
            }
        }

        if (market != null) {
            if (market.tags().contains(MarketEnvironmentState.FAILED_BREAKOUT_ENV)) bias += 14;
            if (market.tags().contains(MarketEnvironmentState.DISTRIBUTION_ENV)) bias += 12;
            if (market.primary() == MarketEnvironmentState.TREND_DAY_BEAR) bias += 10;
            if (market.tags().contains(MarketEnvironmentState.LOW_PARTICIPATION)) bias += 6;
            if (market.tags().contains(MarketEnvironmentState.CHOP)
                    && market.tags().contains(MarketEnvironmentState.MIDDAY_DRIFT)) {
                bias -= 15;
            }
            if (market.primary() == MarketEnvironmentState.TREND_DAY_BULL && market.boostContinuation()) {
                bias -= 22;
            }
        }

        return Math.max(0, Math.min(100, bias));
    }

    public boolean vwapRejected(SymbolContext ctx) {
        if (ctx == null || ctx.getLastPrice() == null || ctx.getLiveVwap() == null) return false;
        return ctx.getLastPrice() < ctx.getLiveVwap().doubleValue() * 0.998;
    }

    public boolean failedReclaim(SymbolContext ctx) {
        if (ctx == null || ctx.getLastPrice() == null || ctx.getLiveVwap() == null) return false;
        double px = ctx.getLastPrice();
        double vwap = ctx.getLiveVwap().doubleValue();
        return px < vwap && px < vwap * 0.995;
    }

    private static boolean lowerHighStructure(SymbolContext ctx) {
        if (ctx == null || ctx.getOpeningRangeHigh() == null || ctx.getLastPrice() == null) {
            return false;
        }
        return ctx.getLastPrice() < ctx.getOpeningRangeHigh().doubleValue() * 0.995;
    }
}
