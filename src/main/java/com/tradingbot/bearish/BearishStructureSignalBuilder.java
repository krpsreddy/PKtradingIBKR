package com.tradingbot.bearish;

import com.tradingbot.bearishassist.BearishBiasEngine;
import com.tradingbot.bearishassist.BearishBiasState;
import com.tradingbot.bearishassist.BearishLifecycleEngine;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.marketstructure.MarketEnvironmentState;
import com.tradingbot.marketstructure.MarketStructureAssessment;
import com.tradingbot.symbol.SymbolContext;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Phase 209 — derives operational bearish metrics from live symbol state. */
@Component
public class BearishStructureSignalBuilder {

    private final BearishBiasEngine biasEngine;
    private final BearishLifecycleEngine lifecycleEngine;

    public BearishStructureSignalBuilder(BearishBiasEngine biasEngine, BearishLifecycleEngine lifecycleEngine) {
        this.biasEngine = biasEngine;
        this.lifecycleEngine = lifecycleEngine;
    }

    public BearishStructureSignals build(
            LiveTraderDtos.RankedOpportunityDto opp,
            SymbolContext ctx,
            MarketStructureAssessment market,
            int exhaustion
    ) {
        boolean failedReclaim = biasEngine.failedReclaim(ctx);
        boolean vwapRejected = biasEngine.vwapRejected(ctx);
        int reclaimFailure = failedReclaim ? 72 : (vwapRejected ? 58 : 28);
        if (opp.degrading()) reclaimFailure += 12;
        if (opp.convictionVelocity() < -4) reclaimFailure += 8;
        reclaimFailure = clamp(reclaimFailure);

        int rejection = clamp(opp.degrading() ? 68 : Math.max(35, 100 - opp.persistenceSeconds()));
        if (vwapRejected) rejection += 10;

        int breakdownAccel = clamp(40 + Math.abs(Math.min(0, opp.convictionVelocity())) * 4
                + (opp.degrading() ? 18 : 0));
        if (failedReclaim) breakdownAccel += 15;

        int distribution = clamp(opp.degrading() ? 55 : 32);
        if (market != null && market.tags().contains(MarketEnvironmentState.DISTRIBUTION_ENV)) {
            distribution += 18;
        }

        double rvol = opp.rvol() > 0 ? opp.rvol() : 1.0;
        int squeeze = clamp(20 + exhaustion / 3 + (rvol < 1.0 ? 15 : 0));

        BearishBiasState state = lifecycleEngine.evaluate(
                opp.conviction(), opp.dominanceScore(), opp.persistenceSeconds(),
                opp.convictionVelocity(), exhaustion, vwapRejected, failedReclaim,
                opp.degrading(), opp.regime());

        boolean vwapLost = ctx != null && ctx.getLastPrice() != null && ctx.getLiveVwap() != null
                && ctx.getLastPrice() < ctx.getLiveVwap().doubleValue();

        List<String> notes = new ArrayList<>();
        if (failedReclaim) notes.add("Failed reclaim");
        if (vwapRejected) notes.add("VWAP rejection");
        if (opp.degrading()) notes.add("Dominance deteriorating");

        return new BearishStructureSignals(
                reclaimFailure, rejection, breakdownAccel, distribution, rvol, squeeze,
                failedReclaim, vwapRejected, vwapLost, state, inferRegime(state, failedReclaim), market, notes);
    }

    public BearishStructureSignals fromScanner(
            String symbol,
            String regime,
            int conviction,
            int velocity,
            int persistence,
            boolean degrading,
            double rvol,
            SymbolContext ctx,
            MarketStructureAssessment market
    ) {
        LiveTraderDtos.RankedOpportunityDto stub = new LiveTraderDtos.RankedOpportunityDto(
                symbol, regime, "WATCH", "YELLOW", "", "DEVELOPING",
                conviction, velocity, persistence, 50, 50, 100,
                List.of(), "—", "LOW", false, degrading, System.currentTimeMillis(),
                "MEDIUM", "PERSISTING", "FLAT", rvol, "—", "—", "—", "LIVE", 0,
                true, System.currentTimeMillis(), null, null);
        return build(stub, ctx, market, degrading ? 55 : 20);
    }

    private static String inferRegime(BearishBiasState state, boolean failedReclaim) {
        if (failedReclaim) return "FAILED_RECLAIM";
        return state.name();
    }

    private static int clamp(int v) {
        return Math.max(0, Math.min(100, v));
    }
}
