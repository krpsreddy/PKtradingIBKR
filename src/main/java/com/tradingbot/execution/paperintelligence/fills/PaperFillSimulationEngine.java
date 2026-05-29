package com.tradingbot.execution.paperintelligence.fills;

import com.tradingbot.execution.paperintelligence.FillQuality;
import com.tradingbot.execution.paperintelligence.entry.EntryExecutionPlan;
import com.tradingbot.livetrader.LiveTraderDtos;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.concurrent.ThreadLocalRandom;

/** Phase 210 — realistic paper fill simulation (no IBKR orders). */
@Component
public class PaperFillSimulationEngine {

    public PaperFillResult simulate(
            LiveTraderDtos.RankedOpportunityDto opp,
            EntryExecutionPlan plan,
            double lastPrice
    ) {
        if (plan.limitPrice() == null || lastPrice <= 0) {
            return PaperFillResult.missed("Invalid limit or price");
        }

        int roll = ThreadLocalRandom.current().nextInt(100);
        if (roll > plan.fillProbability()) {
            return PaperFillResult.missed("Limit not filled — probability " + plan.fillProbability() + "%");
        }

        double spread = lastPrice * 0.001 * (opp.rvol() < 1.2 ? 1.8 : 1.0);
        double slippagePct = plan.slippageRisk() / 1000.0
                + (opp.convictionVelocity() > 6 ? 0.0015 : 0)
                + (opp.rvol() < 1.0 ? 0.002 : 0);
        if (opp.degrading()) slippagePct += 0.002;

        boolean partial = opp.rvol() < 1.3 && ThreadLocalRandom.current().nextInt(100) < 22;
        double fillPx = plan.limitPrice().doubleValue() + spread * 0.5 + lastPrice * slippagePct;
        long latency = 80 + ThreadLocalRandom.current().nextInt(400)
                + (opp.convictionVelocity() > 5 ? 200 : 0);

        FillQuality quality = gradeFill(slippagePct, partial, opp);
        return new PaperFillResult(
                true,
                partial,
                BigDecimal.valueOf(fillPx).setScale(4, RoundingMode.HALF_UP),
                latency,
                quality,
                BigDecimal.valueOf(slippagePct * 100).setScale(3, RoundingMode.HALF_UP),
                null
        );
    }

    private static FillQuality gradeFill(double slippagePct, boolean partial, LiveTraderDtos.RankedOpportunityDto opp) {
        if (partial && opp.rvol() < 1.2) return FillQuality.FAIR;
        if (slippagePct > 0.004) return FillQuality.POOR;
        if (slippagePct > 0.002) return FillQuality.FAIR;
        if (slippagePct > 0.001) return FillQuality.GOOD;
        return FillQuality.EXCELLENT;
    }
}
