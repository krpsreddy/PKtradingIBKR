package com.tradingbot.intelligence.live;

import com.tradingbot.intelligence.execution.realtime.NanoAnomalyDetector;
import com.tradingbot.intelligence.execution.realtime.SymbolTickState;
import com.tradingbot.intelligence.snapshot.IntelligenceScoringEngine;
import com.tradingbot.intelligence.snapshot.IntelligenceSignalContext;
import com.tradingbot.marketstructure.MarketStructureEngine;
import com.tradingbot.symbol.SymbolContext;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Phase 187 — on-the-fly regime engine from live IBKR-enriched symbol context.
 * No evaluated_signal_snapshot dependency.
 */
@Component
public class RealtimeRegimeEngine {

    private final LiveSignalContextFactory contextFactory;
    private final IntelligenceScoringEngine scoringEngine;
    private final MarketSessionClock sessionClock;
    private final MarketStructureEngine marketStructureEngine;

    public RealtimeRegimeEngine(
            LiveSignalContextFactory contextFactory,
            IntelligenceScoringEngine scoringEngine,
            MarketSessionClock sessionClock,
            MarketStructureEngine marketStructureEngine
    ) {
        this.contextFactory = contextFactory;
        this.scoringEngine = scoringEngine;
        this.sessionClock = sessionClock;
        this.marketStructureEngine = marketStructureEngine;
    }

    public record LiveRegimeEvaluation(
            IntelligenceSignalContext context,
            IntelligenceScoringEngine.Scores scores,
            IntelligenceScoringEngine.TriggerResult trigger,
            String fallbackType,
            String fallbackClassification,
            int liveBoost,
            List<String> liveWhyNow,
            String entryZoneLabel
    ) {}

    /** Always returns evaluation — never skips symbol (fallback when trigger inactive). */
    public LiveRegimeEvaluation evaluate(SymbolContext ctx) {
        IntelligenceSignalContext signalCtx = contextFactory.fromSymbolContext(ctx);
        IntelligenceScoringEngine.Scores scores = scoringEngine.score(signalCtx);
        IntelligenceScoringEngine.TriggerResult trigger = scoringEngine.trigger(signalCtx, scores);

        NanoAnomalyDetector.NanoAnomalyResult nano = NanoAnomalyDetector.detect(ctx, SymbolTickState.initial(ctx.getSymbol()));
        List<String> why = new ArrayList<>(nano.signals());
        int liveBoost = Math.min(18, nano.anomalyScore() / 4);
        liveBoost += marketStructureEngine.current().continuationModifier() / 4;
        liveBoost = Math.max(0, Math.min(18, liveBoost));

        String fallbackType = nano.opportunityType();
        String fallbackClass = scoringEngine.classifyRegime(signalCtx, scores);
        if (!trigger.active()) {
            fallbackType = scores.expansionProbability() >= 55
                    ? scoringEngine.detectRegimeType(signalCtx, scores)
                    : fallbackType;
        }

        String entryZone = formatEntryZone(ctx);

        return new LiveRegimeEvaluation(
                signalCtx,
                scores,
                trigger,
                fallbackType,
                fallbackClass,
                liveBoost,
                why,
                entryZone
        );
    }

    public String rvolLabel(SymbolContext ctx, IntelligenceSignalContext signalCtx) {
        Double rvol = signalCtx.rvol();
        if (rvol == null || rvol <= 0) return "—";
        return String.format(Locale.US, "%.1fx", rvol);
    }

    private static String formatEntryZone(SymbolContext ctx) {
        if (ctx.getLastPrice() == null) return "—";
        double p = ctx.getLastPrice();
        double band = p * 0.003;
        return String.format(Locale.US, "%.2f–%.2f", p - band, p + band);
    }
}
