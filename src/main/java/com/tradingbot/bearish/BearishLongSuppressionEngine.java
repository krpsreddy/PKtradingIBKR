package com.tradingbot.bearish;

import com.tradingbot.marketstructure.MarketEnvironmentState;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/** Phase 209 — suppress weak long continuation when bearish structure dominates. */
@Component
public class BearishLongSuppressionEngine {

    public record SuppressionResult(LongSuppressionLevel level, List<String> reasons) {}

    public SuppressionResult evaluate(BearishStructureSignals signals) {
        List<String> reasons = new ArrayList<>();

        boolean failedReclaimBlock = signals.failedReclaim()
                && signals.rejectionPersistence() >= 55
                && signals.breakdownAcceleration() >= 52;

        boolean distributionBlock = signals.distributionPersistence() >= 50
                && signals.downsideRvol() >= 2.0;

        boolean failedBreakoutEnv = signals.market() != null
                && signals.market().tags().contains(MarketEnvironmentState.FAILED_BREAKOUT_ENV);

        if (failedReclaimBlock) {
            reasons.add("Failed reclaim + rejection persistence + breakdown acceleration");
            return new SuppressionResult(LongSuppressionLevel.BLOCK, reasons);
        }
        if (distributionBlock) {
            reasons.add("Distribution persistence + downside RVOL expansion");
            return new SuppressionResult(LongSuppressionLevel.BLOCK, reasons);
        }
        if (failedBreakoutEnv && signals.rejectionPersistence() >= 50) {
            reasons.add("FAILED_BREAKOUT_ENV with active rejection");
            return new SuppressionResult(LongSuppressionLevel.BLOCK, reasons);
        }

        if (signals.reclaimFailureScore() >= 58 || signals.vwapRejected()) {
            reasons.add("Elevated reclaim failure / VWAP rejection");
            return new SuppressionResult(LongSuppressionLevel.DOWNGRADE, reasons);
        }
        if (signals.rejectionPersistence() >= 45 || signals.breakdownAcceleration() >= 48) {
            reasons.add("Bearish pressure building");
            return new SuppressionResult(LongSuppressionLevel.WARNING, reasons);
        }
        return new SuppressionResult(LongSuppressionLevel.NONE, reasons);
    }
}
