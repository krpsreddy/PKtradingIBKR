package com.tradingbot.bearish;

import com.tradingbot.livetrader.LiveTraderDtos;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Phase 209 — detects bullish continuation weakening. */
@Component
public class BullishDeteriorationEngine {

    public record DeteriorationResult(BullishDeteriorationLevel level, List<String> reasons) {}

    public DeteriorationResult evaluate(
            LiveTraderDtos.RankedOpportunityDto opp,
            BearishStructureSignals signals
    ) {
        List<String> reasons = new ArrayList<>();
        String lc = opp.tradeLifecycle() != null ? opp.tradeLifecycle().toUpperCase(Locale.US) : "";
        boolean bullishLifecycle = lc.contains("PERSIST") || lc.contains("SECOND")
                || lc.contains("EARLY") || lc.contains("ACCEL");

        if (!bullishLifecycle && !opp.marketAligned()) {
            return new DeteriorationResult(BullishDeteriorationLevel.HEALTHY, reasons);
        }

        int pressure = 0;
        if (signals.reclaimFailureScore() >= 55) { pressure += 2; reasons.add("Reclaim failure rising"); }
        if (signals.distributionPersistence() >= 48) { pressure += 2; reasons.add("Distribution persistence rising"); }
        if (signals.rejectionPersistence() >= 55) { pressure += 2; reasons.add("Rejection persistence increasing"); }
        if (signals.vwapAcceptanceLost()) { pressure += 2; reasons.add("VWAP acceptance lost"); }
        if (signals.downsideRvol() >= 1.8 && opp.convictionVelocity() < 0) {
            pressure += 1;
            reasons.add("Downside RVOL expanding");
        }
        if (opp.degrading()) { pressure += 2; reasons.add("Dominance deteriorating"); }

        if (pressure >= 6) return new DeteriorationResult(BullishDeteriorationLevel.COLLAPSING, reasons);
        if (pressure >= 4) return new DeteriorationResult(BullishDeteriorationLevel.DETERIORATING, reasons);
        if (pressure >= 2) return new DeteriorationResult(BullishDeteriorationLevel.WARNING, reasons);
        return new DeteriorationResult(BullishDeteriorationLevel.HEALTHY, reasons);
    }
}
