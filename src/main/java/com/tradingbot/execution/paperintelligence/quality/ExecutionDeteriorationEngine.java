package com.tradingbot.execution.paperintelligence.quality;

import com.tradingbot.execution.paperintelligence.ExecutionDeteriorationState;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.symbol.SymbolContext;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class ExecutionDeteriorationEngine {

    public record DeteriorationAssessment(ExecutionDeteriorationState state, List<String> signals) {}

    public DeteriorationAssessment evaluate(
            LiveTraderDtos.RankedOpportunityDto opp,
            SymbolContext ctx,
            int liveVelocity,
            int livePersistence,
            int liveDominance
    ) {
        List<String> signals = new ArrayList<>();
        int score = 0;

        if (opp.degrading()) {
            score += 35;
            signals.add("Dominance degrading");
        }
        if (liveVelocity < opp.convictionVelocity() - 6) {
            score += 20;
            signals.add("Acceleration decay");
        }
        if (livePersistence < opp.persistenceSeconds() - 25) {
            score += 22;
            signals.add("Persistence collapse");
        }
        if (ctx != null && ctx.getLiveVwap() != null && ctx.getLastPrice() != null
                && ctx.getLastPrice() < ctx.getLiveVwap().doubleValue()) {
            score += 28;
            signals.add("VWAP failure");
        }
        if (liveDominance < opp.dominanceScore() - 30) {
            score += 15;
            signals.add("Distribution behavior");
        }
        if (opp.bearishOps() != null && "HIGH".equals(opp.bearishOps().directionalConflict())) {
            score += 12;
            signals.add("Directional conflict");
        }

        ExecutionDeteriorationState state;
        if (score >= 70) state = ExecutionDeteriorationState.COLLAPSING;
        else if (score >= 45) state = ExecutionDeteriorationState.DETERIORATING;
        else if (score >= 25) state = ExecutionDeteriorationState.SOFTENING;
        else state = ExecutionDeteriorationState.HEALTHY;

        return new DeteriorationAssessment(state, signals);
    }
}
