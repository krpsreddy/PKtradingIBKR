package com.tradingbot.executionintelligence;

import com.tradingbot.entry.EntryQualityAssessment;
import com.tradingbot.entry.EntryQualityEngine;
import com.tradingbot.entry.EntryQualityState;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.livetrader.execution.TradeLifecyclePhase;
import com.tradingbot.marketstructure.MarketStructureAssessment;
import com.tradingbot.marketstructure.MarketStructureEngine;
import com.tradingbot.reliability.RegimeReliabilityLearningEngine;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Phases 196–200 — coordinates structure filter, entry quality, reliability learning for execution gates.
 */
@Service
@RequiredArgsConstructor
public class ExecutionIntelligenceCoordinator {

    private final MarketStructureEngine marketStructureEngine;
    private final EntryQualityEngine entryQualityEngine;
    private final RegimeReliabilityLearningEngine reliabilityLearning;
    private final SymbolContextRegistry symbolContextRegistry;

    private final Map<String, OpportunityIntelligenceSnapshot> bySymbol = new ConcurrentHashMap<>();

    public OpportunityIntelligenceSnapshot assess(LiveTraderDtos.RankedOpportunityDto opp) {
        if (opp == null) {
            return OpportunityIntelligenceSnapshot.blocked("No opportunity");
        }
        MarketStructureAssessment market = marketStructureEngine.assess();
        if (!marketStructureEngine.allowsContinuationRegime(opp.regime())) {
            OpportunityIntelligenceSnapshot snap = OpportunityIntelligenceSnapshot.blocked(
                    "Market structure blocks regime " + opp.regime());
            bySymbol.put(opp.symbol().toUpperCase(Locale.US), snap);
            return snap;
        }

        SymbolContext ctx = symbolContextRegistry.get(opp.symbol());
        int exhaustion = inferExhaustion(opp);
        EntryQualityAssessment entry = entryQualityEngine.evaluate(
                ctx,
                opp.conviction(),
                opp.dominanceScore(),
                opp.persistenceSeconds(),
                opp.rvol(),
                opp.convictionVelocity(),
                opp.expansionProbability(),
                exhaustion,
                opp.regime(),
                opp.maturityState(),
                opp.tradeLifecycle(),
                market
        );

        int structureAdjConviction = marketStructureEngine.adjustConviction(
                opp.conviction(), opp.regime(), opp.symbol());
        int reliabilityMod = reliabilityLearning.rankingModifier(
                opp.regime(), market, opp.rvol(), sessionPeriodGuess());
        int adjDominance = Math.max(0, opp.dominanceScore() + market.continuationModifier() + reliabilityMod);
        int adjConviction = Math.max(0, Math.min(market.convictionCap(), structureAdjConviction + reliabilityMod / 2));

        boolean allowed = entry.autoExecutionAllowed()
                && passesLifecycleGate(opp.tradeLifecycle())
                && !opp.degrading();

        String block = allowed ? null : (entry.reason() != null ? entry.reason() : "Execution intelligence gate");

        OpportunityIntelligenceSnapshot snap = new OpportunityIntelligenceSnapshot(
                market, entry, adjDominance, adjConviction, allowed, block);
        bySymbol.put(opp.symbol().toUpperCase(Locale.US), snap);
        return snap;
    }

    public OpportunityIntelligenceSnapshot snapshotFor(String symbol) {
        return bySymbol.get(symbol.toUpperCase(Locale.US));
    }

    public boolean allowsAutoEntry(LiveTraderDtos.RankedOpportunityDto opp) {
        return assess(opp).autoEntryAllowed();
    }

    public String autoEntryBlockReason(LiveTraderDtos.RankedOpportunityDto opp) {
        OpportunityIntelligenceSnapshot s = assess(opp);
        return s.autoEntryAllowed() ? null : s.blockReason();
    }

    public MarketStructureAssessment currentMarketStructure() {
        return marketStructureEngine.current();
    }

    public boolean macroAllowsRegime(String regime) {
        return marketStructureEngine.allowsContinuationRegime(regime);
    }

    private static boolean passesLifecycleGate(String lifecycle) {
        if (lifecycle == null) return false;
        String lc = lifecycle.toUpperCase(Locale.US);
        return lc.equals(TradeLifecyclePhase.CONFIRMED.name())
                || lc.equals(TradeLifecyclePhase.PERSISTING.name())
                || lc.equals(TradeLifecyclePhase.SECOND_LEG.name());
    }

    private static int inferExhaustion(LiveTraderDtos.RankedOpportunityDto opp) {
        if (opp.degrading()) return 65;
        String lc = opp.tradeLifecycle() != null ? opp.tradeLifecycle().toUpperCase(Locale.US) : "";
        if (lc.contains("EXHAUST")) return 70;
        if (lc.contains("FAILED")) return 80;
        return 20;
    }

    private String sessionPeriodGuess() {
        return "SESSION";
    }
}
