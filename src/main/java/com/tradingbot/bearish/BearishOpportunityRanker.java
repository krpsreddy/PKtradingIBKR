package com.tradingbot.bearish;

import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.symbol.SymbolContext;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Phase 209 — ranks downside structures for discretionary PUT assist. */
@Component
public class BearishOpportunityRanker {

    private final BearishStructureSignalBuilder signalBuilder;
    private final BearishMarketAlignmentEngine alignmentEngine;
    private final PutAssistGradeEvaluator gradeEvaluator;

    public BearishOpportunityRanker(
            BearishStructureSignalBuilder signalBuilder,
            BearishMarketAlignmentEngine alignmentEngine,
            PutAssistGradeEvaluator gradeEvaluator
    ) {
        this.signalBuilder = signalBuilder;
        this.alignmentEngine = alignmentEngine;
        this.gradeEvaluator = gradeEvaluator;
    }

    public BearishOpportunityDto rank(
            LiveTraderDtos.RankedOpportunityDto opp,
            SymbolContext ctx,
            BearishStructureSignals signals,
            BearishEnvironment environment,
            BullishDeteriorationLevel deterioration
    ) {
        int score = 0;
        List<String> reasons = new ArrayList<>(signals.notes());

        if (signals.failedReclaim()) { score += 28; reasons.add("Failed reclaim"); }
        if (signals.rejectionPersistence() >= 55) { score += 22; }
        if (signals.breakdownAcceleration() >= 52) { score += 20; }
        if (signals.distributionPersistence() >= 50) { score += 14; }
        if (signals.downsideRvol() >= 1.5) { score += 10; }
        if (environment == BearishEnvironment.FAVORABLE) { score += 12; }
        score -= signals.squeezeRiskScore() / 4;
        if (environment == BearishEnvironment.HOSTILE) score -= 25;

        PutAssistGradeEvaluator.GradeResult grade = gradeEvaluator.evaluate(signals, environment);
        int bias = Math.max(0, Math.min(100, score));
        int contProb = Math.max(0, Math.min(100,
                signals.breakdownAcceleration() + signals.rejectionPersistence() / 2 - signals.squeezeRiskScore() / 3));

        String narrative = "Bearish " + signals.bearishRegime() + " · grade " + grade.grade()
                + " · breakdown " + contProb + "% · squeeze " + signals.squeezeRiskScore();

        return new BearishOpportunityDto(
                opp.symbol(),
                signals.bearishRegime(),
                signals.breakdownAcceleration() >= 60 ? "HIGH" : "MEDIUM",
                bias,
                contProb,
                signals.squeezeRiskScore(),
                deterioration,
                grade.grade(),
                narrative,
                reasons
        );
    }

    public List<BearishOpportunityDto> rankAll(
            List<LiveTraderDtos.RankedOpportunityDto> opps,
            java.util.function.BiFunction<String, LiveTraderDtos.RankedOpportunityDto, SymbolContext> ctxFn,
            com.tradingbot.marketstructure.MarketStructureAssessment market,
            java.util.function.BiFunction<LiveTraderDtos.RankedOpportunityDto, SymbolContext, BullishDeteriorationLevel> deteriorationFn
    ) {
        var env = alignmentEngine.evaluate(market).environment();
        return opps.stream()
                .map(opp -> {
                    SymbolContext ctx = ctxFn.apply(opp.symbol(), opp);
                    BearishStructureSignals sig = signalBuilder.build(opp, ctx, market, opp.degrading() ? 55 : 20);
                    BullishDeteriorationLevel det = deteriorationFn.apply(opp, ctx);
                    return rank(opp, ctx, sig, env, det);
                })
                .sorted(Comparator.comparingInt(BearishOpportunityDto::bearishBias).reversed())
                .toList();
    }
}
