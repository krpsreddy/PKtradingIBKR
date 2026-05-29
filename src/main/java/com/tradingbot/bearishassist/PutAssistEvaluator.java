package com.tradingbot.bearishassist;

import com.tradingbot.bearish.BearishEnvironment;
import com.tradingbot.bearish.BearishMarketAlignmentEngine;
import com.tradingbot.bearish.BearishStructureSignalBuilder;
import com.tradingbot.bearish.BearishStructureSignals;
import com.tradingbot.bearish.PutAssistGrade;
import com.tradingbot.bearish.PutAssistGradeEvaluator;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.marketstructure.MarketEnvironmentState;
import com.tradingbot.marketstructure.MarketStructureAssessment;
import com.tradingbot.sessionintelligence.PremarketIntelligenceService;
import com.tradingbot.symbol.SymbolContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Phase 202 — gates PUT assist (advisory only; user executes puts manually).
 */
@Component
public class PutAssistEvaluator {

    private final BearishBiasEngine biasEngine;
    private final BearishLifecycleEngine lifecycleEngine;
    private final BreakdownContinuationEngine breakdownEngine;
    private final PutAssistNarrativeBuilder narrativeBuilder;
    private final BearishStructureSignalBuilder signalBuilder;
    private final PutAssistGradeEvaluator gradeEvaluator;
    private final BearishMarketAlignmentEngine alignmentEngine;
    private final PremarketIntelligenceService premarketIntelligenceService;

    @Value("${live-trader.put-assist.min-bias:72}")
    private int minBias;

    @Value("${live-trader.put-assist.min-rvol:1.2}")
    private double minRvol;

    public PutAssistEvaluator(
            BearishBiasEngine biasEngine,
            BearishLifecycleEngine lifecycleEngine,
            BreakdownContinuationEngine breakdownEngine,
            PutAssistNarrativeBuilder narrativeBuilder,
            BearishStructureSignalBuilder signalBuilder,
            PutAssistGradeEvaluator gradeEvaluator,
            BearishMarketAlignmentEngine alignmentEngine,
            PremarketIntelligenceService premarketIntelligenceService
    ) {
        this.biasEngine = biasEngine;
        this.lifecycleEngine = lifecycleEngine;
        this.breakdownEngine = breakdownEngine;
        this.narrativeBuilder = narrativeBuilder;
        this.signalBuilder = signalBuilder;
        this.gradeEvaluator = gradeEvaluator;
        this.alignmentEngine = alignmentEngine;
        this.premarketIntelligenceService = premarketIntelligenceService;
    }

    public PutAssistAssessment evaluate(
            LiveTraderDtos.RankedOpportunityDto opp,
            SymbolContext ctx,
            MarketStructureAssessment market,
            int exhaustion
    ) {
        List<String> blocks = new ArrayList<>();

        boolean vwapRejected = biasEngine.vwapRejected(ctx);
        boolean failedReclaim = biasEngine.failedReclaim(ctx);
        boolean persistenceCollapsing = opp.degrading()
                || opp.persistenceSeconds() < 45
                || opp.convictionVelocity() < -4;

        int bias = biasEngine.score(
                ctx,
                opp.conviction(),
                opp.dominanceScore(),
                opp.persistenceSeconds(),
                opp.convictionVelocity(),
                exhaustion,
                opp.degrading(),
                opp.rvol(),
                opp.regime(),
                opp.velocityTrend(),
                market
        );
        if (premarketIntelligenceService.enabled()) {
            bias = Math.min(100, bias + premarketIntelligenceService.bearishModifier(opp.symbol()));
        }

        BearishBiasState state = lifecycleEngine.evaluate(
                opp.conviction(),
                opp.dominanceScore(),
                opp.persistenceSeconds(),
                opp.convictionVelocity(),
                exhaustion,
                vwapRejected,
                failedReclaim,
                opp.degrading(),
                opp.regime()
        );

        BreakdownProbability breakdown = breakdownEngine.evaluate(
                bias, state, persistenceCollapsing, vwapRejected, market);

        if (state == BearishBiasState.EXHAUSTION_BOUNCE) {
            blocks.add("Oversold exhaustion bounce risk");
        }
        if (opp.rvol() < minRvol) {
            blocks.add("RVOL too low for put assist");
        }
        if (market != null && market.tags().contains(MarketEnvironmentState.CHOP)
                && market.tags().contains(MarketEnvironmentState.MIDDAY_DRIFT)) {
            blocks.add("Midday chop — avoid random downside");
        }
        if (market != null && market.primary() == MarketEnvironmentState.TREND_DAY_BULL
                && market.boostContinuation()) {
            blocks.add("Strong trend-day bull structure");
        }
        if (opp.marketAligned() && opp.conviction() >= 75 && !opp.degrading()) {
            blocks.add("Bullish recovery / aligned momentum");
        }
        if (bias < minBias) {
            blocks.add("Bearish bias below threshold (" + bias + " < " + minBias + ")");
        }
        if (!persistenceCollapsing) {
            blocks.add("Persistence not collapsing");
        }
        if (!vwapRejected && !failedReclaim) {
            blocks.add("No VWAP rejection or failed reclaim");
        }

        List<String> reasons = buildReasons(vwapRejected, failedReclaim, persistenceCollapsing, market, opp);
        reasons.addAll(premarketReasons(opp.symbol()));

        PutAssistGrade grade = gradeFor(opp, ctx, market, exhaustion);

        if (!blocks.isEmpty()) {
            String narrative = narrativeBuilder.blocked(opp.symbol(), blocks);
            return new PutAssistAssessment(
                    false, bias, state, breakdown, confidenceFor(bias, breakdown),
                    reasons, blocks, narrative, PutAssistGrade.AVOID);
        }
        if (grade == PutAssistGrade.AVOID) {
            blocks.add("Operational PUT grade AVOID");
            return new PutAssistAssessment(
                    false, bias, state, breakdown, confidenceFor(bias, breakdown),
                    reasons, blocks, narrativeBuilder.blocked(opp.symbol(), blocks), PutAssistGrade.AVOID);
        }

        PutAssistConfidence confidence = confidenceFor(bias, breakdown);
        PutAssistAssessment draft = new PutAssistAssessment(
                true, bias, state, breakdown, confidence, reasons, List.of(), "", grade);
        String narrative = narrativeBuilder.build(
                opp.symbol(), draft, market != null ? market.summary() : null);
        return new PutAssistAssessment(
                true, bias, state, breakdown, confidence, reasons, List.of(), narrative, grade);
    }

    private PutAssistGrade gradeFor(
            LiveTraderDtos.RankedOpportunityDto opp,
            SymbolContext ctx,
            MarketStructureAssessment market,
            int exhaustion
    ) {
        BearishStructureSignals signals = signalBuilder.build(opp, ctx, market, exhaustion);
        BearishEnvironment env = alignmentEngine.evaluate(market).environment();
        return gradeEvaluator.evaluate(signals, env).grade();
    }

    private static List<String> buildReasons(
            boolean vwapRejected,
            boolean failedReclaim,
            boolean persistenceCollapsing,
            MarketStructureAssessment market,
            LiveTraderDtos.RankedOpportunityDto opp
    ) {
        List<String> reasons = new ArrayList<>();
        if (failedReclaim) reasons.add("Failed reclaim");
        if (vwapRejected) reasons.add("VWAP rejection");
        if (persistenceCollapsing) reasons.add("Persistence collapse");
        if (opp.degrading()) reasons.add("Dominance deterioration");
        if (market != null && market.tags().contains(MarketEnvironmentState.FAILED_BREAKOUT_ENV)) {
            reasons.add("Failed breakout environment");
        }
        if (market != null && market.primary() == MarketEnvironmentState.TREND_DAY_BEAR) {
            reasons.add("Bearish market structure");
        }
        String regime = opp.regime() != null ? opp.regime().toUpperCase(Locale.US) : "";
        if (regime.contains("FAIL") || regime.contains("EXHAUST")) {
            reasons.add("Failed continuation regime");
        }
        return reasons;
    }

    private List<String> premarketReasons(String symbol) {
        List<String> reasons = new ArrayList<>();
        if (!premarketIntelligenceService.enabled()) return reasons;
        premarketIntelligenceService.get(symbol).ifPresent(pm -> {
            if (pm.premarketReclaimFailure()) reasons.add("PM reclaim failure");
            if (pm.premarketDistribution()) reasons.add("PM distribution");
            if (pm.operationalChip() != null) reasons.add(pm.operationalChip());
        });
        return reasons;
    }

    private static PutAssistConfidence confidenceFor(int bias, BreakdownProbability breakdown) {
        if (bias >= 85 && breakdown == BreakdownProbability.HIGH) {
            return PutAssistConfidence.HIGH;
        }
        if (bias >= 75 && breakdown != BreakdownProbability.LOW) {
            return PutAssistConfidence.MEDIUM;
        }
        return PutAssistConfidence.LOW;
    }
}
