package com.tradingbot.sessionintelligence.session;

import com.tradingbot.sessionintelligence.premarket.PremarketSnapshotDto;
import com.tradingbot.sessionintelligence.premarket.PremarketTrendState;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/** Phase 211 — bridge 9:00–9:30 PM context into RTH open. */
@Component
public class OpenTransitionEngine {

    public record OpenTransition(
            String state,
            int continuationBoost,
            int bearishBoost,
            int squeezeAdjustment,
            List<String> signals
    ) {}

    public OpenTransition evaluate(PremarketSnapshotDto pm, int minutesSinceOpen, double lastPrice) {
        List<String> signals = new ArrayList<>();
        if (pm == null) {
            return new OpenTransition("UNKNOWN", 0, 0, 0, signals);
        }

        int bullBoost = 0;
        int bearBoost = 0;
        int squeezeAdj = pm.squeezeRisk();
        String state = "NEUTRAL";

        if (minutesSinceOpen <= 15) {
            switch (pm.trendState()) {
                case HEALTHY_CONTINUATION, EARLY_EXPANSION -> {
                    if (pm.premarketVWAP() > 0 && lastPrice >= pm.premarketVWAP()) {
                        state = "GAP_HOLD";
                        bullBoost = 12;
                        signals.add("Gap hold above PM VWAP");
                    }
                }
                case FAILED_GAP, RECLAIM_FAILURE, PM_BREAKDOWN -> {
                    state = "GAP_FAILURE";
                    bearBoost = 15;
                    bullBoost = -18;
                    signals.add("Failed gap / reclaim at open");
                }
                case DISTRIBUTION -> {
                    state = "PM_DISTRIBUTION";
                    bearBoost = 12;
                    bullBoost = -10;
                    signals.add("PM distribution continuing");
                }
                case PARABOLIC_EXTENSION -> {
                    state = "OPENING_SQUEEZE_RISK";
                    squeezeAdj += 15;
                    bullBoost = -8;
                    signals.add("Parabolic PM — fade risk at open");
                }
                default -> {
                    if (pm.openingContinuationProbability() >= 65) {
                        state = "OPENING_DRIVE";
                        bullBoost = 8;
                    }
                }
            }
        }

        if (pm.premarketReclaimFailure()) {
            bearBoost += 8;
            signals.add("PM reclaim failure");
        }

        return new OpenTransition(state, bullBoost, bearBoost, squeezeAdj, signals);
    }

    public static boolean isBearishPm(PremarketTrendState t) {
        return t == PremarketTrendState.FAILED_GAP
                || t == PremarketTrendState.RECLAIM_FAILURE
                || t == PremarketTrendState.PM_BREAKDOWN
                || t == PremarketTrendState.DISTRIBUTION;
    }
}
