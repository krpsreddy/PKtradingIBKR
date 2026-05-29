package com.tradingbot.sessionintelligence.premarket;

import com.tradingbot.sessionintelligence.gap.PremarketGapAnalysisEngine;
import com.tradingbot.sessionintelligence.vwap.PremarketVWAPEngine;
import org.springframework.stereotype.Component;

@Component
public class PremarketTrendClassifier {

    public PremarketTrendState classify(
            PremarketGapAnalysisEngine.GapAnalysis gap,
            PremarketVWAPEngine.VwapAnalysis vwap,
            PremarketPersistenceEngine.PersistenceAnalysis persist,
            double gapPct
    ) {
        if (vwap.rejectionBelow() && gap.gapPct() > 1) return PremarketTrendState.RECLAIM_FAILURE;
        if (gap.gapBias() == PremarketTrendState.FAILED_GAP) return PremarketTrendState.FAILED_GAP;
        if (gap.exhaustionRisk() >= 70 || gap.gapBias() == PremarketTrendState.PARABOLIC_EXTENSION) {
            return PremarketTrendState.PARABOLIC_EXTENSION;
        }
        if (persist.continuationSurvival() < 40 && gapPct > 2) return PremarketTrendState.DISTRIBUTION;
        if (persist.trendQuality() < 35) return PremarketTrendState.WEAK_DRIFT;
        if (vwap.reclaimAbove() && persist.continuationSurvival() >= 55) {
            return PremarketTrendState.HEALTHY_CONTINUATION;
        }
        if (persist.accelerationConsistency() >= 60) return PremarketTrendState.EARLY_EXPANSION;
        if (vwap.rejectionBelow()) return PremarketTrendState.PM_BREAKDOWN;
        return PremarketTrendState.WEAK_DRIFT;
    }
}
