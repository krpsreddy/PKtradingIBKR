package com.tradingbot.sessionintelligence.premarket;

import com.tradingbot.models.Candle;
import com.tradingbot.sessionintelligence.gap.PremarketGapAnalysisEngine;
import com.tradingbot.sessionintelligence.session.OpenTransitionEngine;
import com.tradingbot.sessionintelligence.vwap.PremarketVWAPEngine;
import com.tradingbot.symbol.SymbolContext;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/** Phase 211 — lightweight PM structural snapshot builder. */
@Component
public class PremarketIntelligenceEngine {

    private final PremarketGapAnalysisEngine gapEngine;
    private final PremarketVWAPEngine vwapEngine;
    private final PremarketPersistenceEngine persistenceEngine;
    private final PremarketRVOLAnalyzer rvolAnalyzer;
    private final PremarketTrendClassifier trendClassifier;
    private final OpenTransitionEngine openTransitionEngine;

    public PremarketIntelligenceEngine(
            PremarketGapAnalysisEngine gapEngine,
            PremarketVWAPEngine vwapEngine,
            PremarketPersistenceEngine persistenceEngine,
            PremarketRVOLAnalyzer rvolAnalyzer,
            PremarketTrendClassifier trendClassifier,
            OpenTransitionEngine openTransitionEngine
    ) {
        this.gapEngine = gapEngine;
        this.vwapEngine = vwapEngine;
        this.persistenceEngine = persistenceEngine;
        this.rvolAnalyzer = rvolAnalyzer;
        this.trendClassifier = trendClassifier;
        this.openTransitionEngine = openTransitionEngine;
    }

    public PremarketSnapshotDto build(String symbol, SymbolContext ctx, List<Candle> pmBars) {
        if (ctx == null) {
            return PremarketSnapshotDto.empty(symbol);
        }

        double last = ctx.getLastPrice() != null ? ctx.getLastPrice() : 0;
        double pmHigh = ctx.getPremarketHigh() != null ? ctx.getPremarketHigh().doubleValue() : last;
        double pmLow = ctx.getPremarketLow() != null ? ctx.getPremarketLow().doubleValue() : last;
        double gap = ctx.getGapPercent() != null ? ctx.getGapPercent() : 0;

        var vwap = vwapEngine.analyze(pmBars, last);
        var persist = persistenceEngine.analyze(pmBars, gap);
        double rvol = ctx.getLiveEstimatedRvol() != null ? ctx.getLiveEstimatedRvol()
                : (ctx.getRelativeVolume() != null ? ctx.getRelativeVolume() : 1.0);
        var rvolA = rvolAnalyzer.analyze(rvol, ctx.getAvgDailyVolume());
        var gapA = gapEngine.analyze(gap, persist.continuationSurvival(), persist.trendQuality(),
                vwap.integrityHeld(), rvolA.rvol());

        PremarketTrendState trend = trendClassifier.classify(gapA, vwap, persist, gap);

        int quality = (gapA.gapQuality() + persist.trendQuality() + rvolA.participationQuality()) / 3;
        if (vwap.rejectionBelow()) quality -= 15;
        if (gapA.goodGap()) quality += 10;
        quality = Math.max(0, Math.min(100, quality));

        int openProb = gapA.sustainability() + persist.continuationSurvival() / 2 - gapA.exhaustionRisk() / 3;
        openProb = Math.max(0, Math.min(100, openProb));

        int squeeze = gapA.exhaustionRisk() / 2 + (trend == PremarketTrendState.PARABOLIC_EXTENSION ? 25 : 0);

        String bias = gap > 1.5 ? "BULLISH" : (gap < -1 ? "BEARISH" : "NEUTRAL");
        if (OpenTransitionEngine.isBearishPm(trend)) bias = "BEARISH";

        int accel = persist.accelerationConsistency();
        String breakout = vwap.reclaimAbove() ? "PM_RECLAIM" : (vwap.rejectionBelow() ? "PM_REJECT" : "RANGE");

        return new PremarketSnapshotDto(
                symbol.toUpperCase(Locale.US),
                gap,
                pmHigh,
                pmLow,
                vwap.vwap(),
                rvolA.rvol(),
                persist.trendQuality(),
                persist.continuationSurvival(),
                accel,
                breakout,
                vwap.rejectionBelow() && !vwap.reclaimAbove(),
                trend == PremarketTrendState.DISTRIBUTION,
                bias,
                quality,
                openProb,
                squeeze,
                trend,
                operationalChip(trend, quality),
                System.currentTimeMillis()
        );
    }

    public OpenTransitionEngine.OpenTransition openContext(
            PremarketSnapshotDto pm,
            int minutesSinceRthOpen,
            double lastPrice
    ) {
        return openTransitionEngine.evaluate(pm, minutesSinceRthOpen, lastPrice);
    }

    private static String operationalChip(PremarketTrendState trend, int quality) {
        if (quality >= 72 && (trend == PremarketTrendState.HEALTHY_CONTINUATION
                || trend == PremarketTrendState.EARLY_EXPANSION)) {
            return "PM STRONG";
        }
        if (trend == PremarketTrendState.FAILED_GAP) return "FAILED GAP";
        if (trend == PremarketTrendState.DISTRIBUTION) return "PM DISTRIBUTION";
        if (quality < 40 || trend == PremarketTrendState.WEAK_DRIFT) return "PM WEAK";
        if (trend == PremarketTrendState.RECLAIM_FAILURE || trend == PremarketTrendState.PM_BREAKDOWN) {
            return "PM RECLAIM FAIL";
        }
        return null;
    }
}
