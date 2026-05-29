package com.tradingbot.intelligence.live;

import com.tradingbot.api.dto.IndicatorDto;
import com.tradingbot.intelligence.snapshot.IntelligenceSignalContext;
import com.tradingbot.symbol.SymbolContext;
import org.springframework.stereotype.Component;

import java.time.Instant;

/** Builds live intelligence context from in-memory symbol state (no analytics DB). */
@Component
public class LiveSignalContextFactory {

    private final MarketSessionClock sessionClock;

    public LiveSignalContextFactory(MarketSessionClock sessionClock) {
        this.sessionClock = sessionClock;
    }

    public IntelligenceSignalContext fromSymbolContext(SymbolContext ctx) {
        String sym = ctx.getSymbol();
        IndicatorDto ind = ctx.getLatestIndicators();
        Double rvol = firstNonNull(ctx.getLiveEstimatedRvol(), ctx.getRelativeVolume(),
                ind != null ? ind.getRelativeVolume() : null);
        Double vwapDist = vwapDistancePct(ctx, ind);
        Double trendAlign = trendAlignment(ctx, ind);
        String regime = mapMarketRegime(ctx);
        String signalType = firstNonBlank(ctx.getReadinessState(), ctx.getSignalState(), "LIVE_SCAN");
        Double price = ctx.getLastPrice();
        Boolean extended = ctx.getGapPercent() != null && ctx.getGapPercent() > 2.5;
        Double vol = ind != null && ind.getAvgVolume() > 0
                ? (double) ind.getAvgVolume() : null;

        long ts = ctx.getLastUpdate() != null ? ctx.getLastUpdate().toEpochMilli() : Instant.now().toEpochMilli();
        return new IntelligenceSignalContext(
                "live-" + sym + "-" + sessionClock.sessionDayKey(),
                sym,
                sessionClock.sessionDayKey(),
                ts,
                0,
                regime,
                signalType,
                rvol,
                vwapDist,
                trendAlign,
                trendAlign,
                extended,
                vol,
                price,
                sessionClock.sessionMinutesSinceRthOpen(),
                0
        );
    }

    private static Double vwapDistancePct(SymbolContext ctx, IndicatorDto ind) {
        Double price = ctx.getLastPrice();
        if (price == null) return null;
        double vwap;
        if (ctx.getLiveVwap() != null) {
            vwap = ctx.getLiveVwap().doubleValue();
        } else if (ind != null && ind.getVwap() > 0) {
            vwap = ind.getVwap();
        } else {
            return null;
        }
        if (vwap <= 0) return null;
        return ((price - vwap) / vwap) * 100.0;
    }

    private static Double trendAlignment(SymbolContext ctx, IndicatorDto ind) {
        if (ind != null && ind.getEma9() > 0 && ind.getEma20() > 0) {
            double spread = (ind.getEma9() - ind.getEma20()) / ind.getEma20() * 100;
            return Math.max(-100, Math.min(100, spread * 8));
        }
        if ("bullish".equalsIgnoreCase(ctx.getTrend())) return 72.0;
        if ("bearish".equalsIgnoreCase(ctx.getTrend())) return 28.0;
        return 50.0;
    }

    private static String mapMarketRegime(SymbolContext ctx) {
        String trend = ctx.getTrend() != null ? ctx.getTrend().toLowerCase() : "neutral";
        String lifecycle = ctx.getLifecycleState() != null ? ctx.getLifecycleState().toUpperCase() : "";
        if (lifecycle.contains("EXHAUST")) return "EXHAUSTION";
        if ("bullish".equals(trend)) return "TREND_UP";
        if ("bearish".equals(trend)) return "TREND_DOWN";
        return "CHOP";
    }

    private static Double firstNonNull(Double... values) {
        for (Double v : values) {
            if (v != null && !v.isNaN()) return v;
        }
        return null;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }
}
