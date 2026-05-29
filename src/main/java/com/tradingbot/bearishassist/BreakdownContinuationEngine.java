package com.tradingbot.bearishassist;

import com.tradingbot.marketstructure.MarketEnvironmentState;
import com.tradingbot.marketstructure.MarketStructureAssessment;
import org.springframework.stereotype.Component;

/**
 * Phase 202 — downside continuation probability (dedicated bearish logic).
 */
@Component
public class BreakdownContinuationEngine {

    public BreakdownProbability evaluate(
            int bearishBias,
            BearishBiasState state,
            boolean persistenceCollapsing,
            boolean vwapRejected,
            MarketStructureAssessment market
    ) {
        if (state == BearishBiasState.EXHAUSTION_BOUNCE) {
            return BreakdownProbability.LOW;
        }
        int score = bearishBias;
        if (persistenceCollapsing) score += 8;
        if (vwapRejected) score += 10;
        if (market != null) {
            if (market.tags().contains(MarketEnvironmentState.FAILED_BREAKOUT_ENV)
                    || market.tags().contains(MarketEnvironmentState.DISTRIBUTION_ENV)) {
                score += 12;
            }
            if (market.primary() == MarketEnvironmentState.TREND_DAY_BEAR) {
                score += 10;
            }
            if (market.boostContinuation()) {
                score -= 18;
            }
        }
        if (state == BearishBiasState.BREAKDOWN_CONFIRMATION || state == BearishBiasState.ACCELERATED_SELLING) {
            score += 8;
        }
        if (score >= 88) return BreakdownProbability.HIGH;
        if (score >= 68) return BreakdownProbability.MEDIUM;
        return BreakdownProbability.LOW;
    }
}
