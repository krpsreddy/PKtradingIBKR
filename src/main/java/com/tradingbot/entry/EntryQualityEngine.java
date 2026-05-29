package com.tradingbot.entry;

import com.tradingbot.livetrader.execution.TradeLifecyclePhase;
import com.tradingbot.marketstructure.MarketEnvironmentState;
import com.tradingbot.marketstructure.MarketStructureAssessment;
import com.tradingbot.symbol.SymbolContext;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Phase 197 — grades entry quality; auto paper only on IDEAL / EARLY / CONFIRMED.
 */
@Component
public class EntryQualityEngine {

    public EntryQualityAssessment evaluate(
            SymbolContext ctx,
            int conviction,
            int dominance,
            int persistenceSec,
            double rvol,
            int velocity,
            int expansion,
            int exhaustion,
            String regime,
            String maturityState,
            String lifecycle,
            MarketStructureAssessment market
    ) {
        int score = 0;
        score += conviction / 5;
        score += dominance / 10;
        score += Math.min(20, persistenceSec / 4);
        score += rvol >= 2.5 ? 14 : rvol >= 1.8 ? 10 : rvol >= 1.2 ? 4 : -8;
        score += velocity > 6 ? 8 : velocity < -5 ? -10 : 0;
        score += expansion / 10;
        score -= exhaustion / 5;

        EntryQualityState state = EntryQualityState.CONFIRMED;

        if (market != null) {
            if (market.tags().contains(MarketEnvironmentState.LOW_PARTICIPATION)) {
                score -= 12;
            }
            if (market.tags().contains(MarketEnvironmentState.CHOP)) {
                score -= 8;
            }
        }

        String lc = lifecycle != null ? lifecycle.toUpperCase(Locale.US) : "";
        if (lc.contains("EXTENDED") || (maturityState != null && maturityState.contains("EXTENDED"))) {
            state = EntryQualityState.EXTENDED;
            score -= 18;
        } else if (lc.contains("EXHAUST") || exhaustion >= 55) {
            state = EntryQualityState.LATE;
            score -= 22;
        } else if (velocity >= 10 && persistenceSec < 40) {
            state = EntryQualityState.CHASING;
            score -= 20;
        } else if (dominance < 85 || persistenceSec < 35) {
            state = EntryQualityState.WEAK_STRUCTURE;
            score -= 15;
        } else if (rvol < 1.0) {
            state = EntryQualityState.LOW_PARTICIPATION;
            score -= 14;
        } else if (conviction >= 82 && dominance >= 125 && persistenceSec >= 70 && rvol >= 2.2) {
            state = EntryQualityState.IDEAL;
            score += 10;
        } else if (conviction >= 72 && dominance >= 100 && persistenceSec >= 50) {
            state = EntryQualityState.EARLY;
        } else if (lc.equals(TradeLifecyclePhase.CONFIRMED.name())
                || lc.equals(TradeLifecyclePhase.PERSISTING.name())) {
            state = EntryQualityState.CONFIRMED;
        } else if (conviction >= 60) {
            state = EntryQualityState.EARLY;
        } else {
            state = EntryQualityState.WEAK_STRUCTURE;
        }

        double vwapDist = vwapDistancePct(ctx);
        if (vwapDist > 1.8) {
            if (state == EntryQualityState.IDEAL || state == EntryQualityState.CONFIRMED) {
                state = EntryQualityState.LATE;
            } else if (state == EntryQualityState.EARLY) {
                state = EntryQualityState.CHASING;
            }
            score -= 12;
        }

        boolean allowed = state == EntryQualityState.IDEAL
                || state == EntryQualityState.EARLY
                || state == EntryQualityState.CONFIRMED;

        String reason = allowed
                ? "Entry " + state.name() + " · score " + score
                : "Blocked entry " + state.name() + " · score " + score;

        return new EntryQualityAssessment(state, score, allowed, reason);
    }

    private static double vwapDistancePct(SymbolContext ctx) {
        if (ctx == null || ctx.getLastPrice() == null || ctx.getLiveVwap() == null) return 0;
        double vwap = ctx.getLiveVwap().doubleValue();
        if (vwap <= 0) return 0;
        return Math.abs(ctx.getLastPrice() - vwap) / vwap * 100.0;
    }
}
