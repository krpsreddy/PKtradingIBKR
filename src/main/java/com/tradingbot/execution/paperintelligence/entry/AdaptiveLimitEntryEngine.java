package com.tradingbot.execution.paperintelligence.entry;

import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.symbol.SymbolContext;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

/** Phase 210 — regime-aware limit entry planning (simulated). */
@Component
public class AdaptiveLimitEntryEngine {

    public EntryExecutionPlan plan(
            LiveTraderDtos.RankedOpportunityDto opp,
            SymbolContext ctx,
            double referencePrice
    ) {
        if (referencePrice <= 0) {
            return new EntryExecutionPlan(null, BigDecimal.ZERO, 0, 100, 30, "UNKNOWN", "No reference price");
        }
        String regime = opp.regime() != null ? opp.regime().toUpperCase(Locale.US) : "";
        double atr = referencePrice * 0.012;
        double spread = estimateSpread(ctx, referencePrice);
        String style = classifyStyle(regime);

        double offset = switch (style) {
            case "BREAKOUT_CONTINUATION" -> atr * 0.15 + spread;
            case "PULLBACK_CONTINUATION" -> -atr * 0.08;
            case "COMPRESSION_RELEASE" -> atr * 0.22;
            case "PARABOLIC" -> atr * 0.45;
            default -> atr * 0.12;
        };
        if (opp.convictionVelocity() > 8) offset += atr * 0.08;
        if (opp.rvol() >= 2.5) offset += atr * 0.05;

        BigDecimal limit = BigDecimal.valueOf(referencePrice + offset).setScale(4, RoundingMode.HALF_UP);
        BigDecimal entryOffset = BigDecimal.valueOf(offset / referencePrice * 100).setScale(3, RoundingMode.HALF_UP);

        int fillProb = baseFillProbability(opp, style);
        int slippageRisk = slippageRisk(opp, style);
        int staleSec = staleSeconds(opp, style);

        String narrative = style + " limit @" + limit + " · fill~" + fillProb + "% · stale " + staleSec + "s";
        return new EntryExecutionPlan(limit, entryOffset, fillProb, slippageRisk, staleSec, style, narrative);
    }

    private static String classifyStyle(String regime) {
        if (regime.contains("PARABOL") || regime.contains("LATE") || regime.contains("EXTENDED")) {
            return "PARABOLIC";
        }
        if (regime.contains("PULLBACK") || regime.contains("VWAP")) {
            return "PULLBACK_CONTINUATION";
        }
        if (regime.contains("COMPRESSION") || regime.contains("MICRO")) {
            return "COMPRESSION_RELEASE";
        }
        if (regime.contains("ORB") || regime.contains("ACCEL") || regime.contains("BREAK")) {
            return "BREAKOUT_CONTINUATION";
        }
        return "BREAKOUT_CONTINUATION";
    }

    private static int baseFillProbability(LiveTraderDtos.RankedOpportunityDto opp, String style) {
        int p = 72;
        if ("PULLBACK_CONTINUATION".equals(style)) p += 8;
        if ("PARABOLIC".equals(style)) p -= 18;
        if (opp.rvol() >= 2) p += 6;
        if (opp.convictionVelocity() > 6) p -= 10;
        if (opp.degrading()) p -= 20;
        return Math.max(15, Math.min(95, p));
    }

    private static int slippageRisk(LiveTraderDtos.RankedOpportunityDto opp, String style) {
        int r = 30;
        if ("PARABOLIC".equals(style)) r += 25;
        if (opp.rvol() < 1.2) r += 20;
        if (opp.convictionVelocity() > 8) r += 15;
        return Math.min(100, r);
    }

    private static int staleSeconds(LiveTraderDtos.RankedOpportunityDto opp, String style) {
        int s = 90;
        if ("PARABOLIC".equals(style)) s = 45;
        if (opp.emergingFast()) s = 60;
        return s;
    }

    private static double estimateSpread(SymbolContext ctx, double price) {
        if (ctx != null && ctx.getRelativeVolume() != null && ctx.getRelativeVolume() < 1.0) {
            return price * 0.0012;
        }
        return price * 0.0008;
    }
}
