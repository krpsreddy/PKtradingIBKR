package com.tradingbot.bearish;

import com.tradingbot.livetrader.LiveTraderDtos;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Phase 209 — detects simultaneous bullish and bearish structural signals. */
@Component
public class DirectionalConflictEngine {

    public record ConflictResult(DirectionalConflict level, List<String> reasons) {}

    public ConflictResult evaluate(LiveTraderDtos.RankedOpportunityDto opp, BearishStructureSignals signals) {
        List<String> reasons = new ArrayList<>();
        boolean bullish = isBullishContinuation(opp);
        boolean bearish = signals.failedReclaim()
                || "FAILED_RECLAIM".equalsIgnoreCase(signals.bearishRegime())
                || signals.rejectionPersistence() >= 60;

        if (bullish && bearish) {
            reasons.add("Bullish lifecycle " + opp.tradeLifecycle() + " vs bearish " + signals.bearishRegime());
            if (opp.conviction() >= 70 && signals.reclaimFailureScore() >= 60) {
                return new ConflictResult(DirectionalConflict.HIGH, reasons);
            }
            return new ConflictResult(DirectionalConflict.MODERATE, reasons);
        }
        if (bullish && signals.rejectionPersistence() >= 45) {
            reasons.add("Mild bearish pressure on bullish setup");
            return new ConflictResult(DirectionalConflict.LOW, reasons);
        }
        return new ConflictResult(DirectionalConflict.NONE, reasons);
    }

    private static boolean isBullishContinuation(LiveTraderDtos.RankedOpportunityDto opp) {
        String lc = opp.tradeLifecycle() != null ? opp.tradeLifecycle().toUpperCase(Locale.US) : "";
        String regime = opp.regime() != null ? opp.regime().toUpperCase(Locale.US) : "";
        return lc.contains("EARLY") || lc.contains("ACCEL") || lc.contains("PERSIST")
                || lc.contains("SECOND") || regime.contains("CONTINUATION") || regime.contains("EXPANSION");
    }
}
