package com.tradingbot.bearish;

import com.tradingbot.marketstructure.MarketEnvironmentState;
import com.tradingbot.marketstructure.MarketStructureAssessment;
import com.tradingbot.sessionintelligence.PremarketIntelligenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/** Phase 209 — broad market environment for bearish structures. */
@Component
@RequiredArgsConstructor
public class BearishMarketAlignmentEngine {

    private final PremarketIntelligenceService premarketIntelligenceService;

    public record AlignmentResult(BearishEnvironment environment, List<String> factors) {}

    public AlignmentResult evaluate(MarketStructureAssessment market) {
        int pmCluster = premarketIntelligenceService.enabled()
                ? premarketIntelligenceService.marketBearishFactor() : 0;
        return evaluate(market, pmCluster);
    }

    public AlignmentResult evaluate(MarketStructureAssessment market, int pmBearishClusterPct) {
        List<String> factors = new ArrayList<>();
        if (market == null) {
            return new AlignmentResult(BearishEnvironment.NEUTRAL, factors);
        }

        int bearish = 0;
        int bullish = 0;

        if (market.primary() == MarketEnvironmentState.TREND_DAY_BEAR) {
            bearish += 2;
            factors.add("Bear trend day");
        }
        if (market.tags().contains(MarketEnvironmentState.FAILED_BREAKOUT_ENV)) {
            bearish += 2;
            factors.add("Failed breakouts increasing");
        }
        if (market.tags().contains(MarketEnvironmentState.DISTRIBUTION_ENV)) {
            bearish += 1;
            factors.add("Distribution environment");
        }
        if (market.tags().contains(MarketEnvironmentState.LOW_PARTICIPATION)) {
            bearish += 1;
            factors.add("Weak opening continuation");
        }
        if (market.primary() == MarketEnvironmentState.TREND_DAY_BULL && market.boostContinuation()) {
            bullish += 3;
            factors.add("Strong bull trend day");
        }
        if (market.tags().contains(MarketEnvironmentState.CHOP)) {
            bullish += 1;
        }
        if (pmBearishClusterPct >= 45) {
            bearish += 1;
            factors.add("PM bearish cluster (" + pmBearishClusterPct + "% watchlist)");
        }

        if (bearish >= 3 && bullish == 0) return new AlignmentResult(BearishEnvironment.FAVORABLE, factors);
        if (bullish >= 2) return new AlignmentResult(BearishEnvironment.HOSTILE, factors);
        return new AlignmentResult(BearishEnvironment.NEUTRAL, factors);
    }
}
