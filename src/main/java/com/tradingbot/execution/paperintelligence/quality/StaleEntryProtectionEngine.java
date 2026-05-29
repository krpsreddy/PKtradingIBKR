package com.tradingbot.execution.paperintelligence.quality;

import com.tradingbot.execution.paperintelligence.entry.EntryExecutionPlan;
import com.tradingbot.livetrader.LiveTraderDtos;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class StaleEntryProtectionEngine {

    public record StaleCheck(boolean stale, List<String> reasons) {}

    public StaleCheck evaluate(LiveTraderDtos.RankedOpportunityDto opp, EntryExecutionPlan plan) {
        List<String> reasons = new ArrayList<>();
        if (opp.degrading()) reasons.add("Opportunity degrading");
        if (opp.convictionVelocity() < -3) reasons.add("Velocity collapsed");
        if (opp.persistenceSeconds() < 40 && !opp.emergingFast()) reasons.add("Persistence too weak");
        if (opp.riskLabel() != null && "HIGH".equalsIgnoreCase(opp.riskLabel())) {
            reasons.add("High continuation risk");
        }
        if (plan != null && plan.slippageRisk() >= 75) reasons.add("Slippage risk extreme");
        if (opp.bearishOps() != null && "BLOCK".equals(opp.bearishOps().longSuppression())) {
            reasons.add("Long suppressed");
        }
        return new StaleCheck(!reasons.isEmpty(), reasons);
    }
}
