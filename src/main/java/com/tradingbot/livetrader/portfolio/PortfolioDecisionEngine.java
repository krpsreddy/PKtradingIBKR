package com.tradingbot.livetrader.portfolio;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.MarketHeartbeatDto;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.bearish.BearishOperationalService;
import com.tradingbot.executionintelligence.ExecutionIntelligenceCoordinator;
import com.tradingbot.livetrader.execution.ExecutionQuality;
import com.tradingbot.livetrader.execution.TradeLifecyclePhase;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Phase 189 — deterministic orchestration rules (advisory + execution gate).
 */
@Component
public class PortfolioDecisionEngine {

    private static final int MIN_CONVICTION = 75;
    private static final int MIN_DOMINANCE = 120;
    private static final int MIN_PERSISTENCE = 60;
    private static final double MIN_RVOL = 1.5;

    private final CorrelationSuppressionEngine correlationEngine;
    private final IBKRClientService ibkrClientService;
    private final ExecutionIntelligenceCoordinator executionIntelligence;
    private final BearishOperationalService bearishOperationalService;

    @Value("${live-trader.portfolio.queue-min-dominance:100}")
    private int queueMinDominance;

    public PortfolioDecisionEngine(
            CorrelationSuppressionEngine correlationEngine,
            IBKRClientService ibkrClientService,
            ExecutionIntelligenceCoordinator executionIntelligence,
            BearishOperationalService bearishOperationalService
    ) {
        this.correlationEngine = correlationEngine;
        this.ibkrClientService = ibkrClientService;
        this.executionIntelligence = executionIntelligence;
        this.bearishOperationalService = bearishOperationalService;
    }

    public PortfolioDecision evaluate(
            LiveTraderDtos.RankedOpportunityDto opp,
            PortfolioExposureModel exposure,
            MarketHeartbeatDto market,
            boolean slotAvailable
    ) {
        if (bearishOperationalService.blocksAutoExecution(opp)) {
            var ops = opp.bearishOps();
            String reason = ops != null && ops.longSuppression() != null
                    ? "Bearish suppression " + ops.longSuppression()
                    : "Bearish structural conflict blocks long execution";
            return PortfolioDecision.suppress(OrchestrationState.SUPPRESSED, reason);
        }
        String marketReject = marketRejectReason(opp, market);
        if (marketReject != null) {
            return PortfolioDecision.suppress(OrchestrationState.REJECTED_MARKET, marketReject);
        }

        String qualityReject = qualityRejectReason(opp);
        if (qualityReject != null) {
            return PortfolioDecision.suppress(OrchestrationState.REJECTED_QUALITY, qualityReject);
        }

        if (exposure.hasActive()) {
            if (opp.symbol().equalsIgnoreCase(exposure.symbol())) {
                return PortfolioDecision.execute("Active position");
            }

            var corr = correlationEngine.suppressionReason(exposure.symbol(), opp.symbol());
            if (corr.isPresent()) {
                return PortfolioDecision.suppress(OrchestrationState.REJECTED_CORRELATION, corr.get());
            }

            if (replacementAdvisory(exposure, opp)) {
                return PortfolioDecision.replacement(
                        "Higher quality continuation detected vs " + exposure.symbol());
            }

            if (opp.dominanceScore() >= queueMinDominance) {
                return PortfolioDecision.queue("Active slot occupied — ranked for next entry");
            }
            return PortfolioDecision.suppress(OrchestrationState.SUPPRESSED, "Below queue threshold");
        }

        if (slotAvailable && passesAutoGates(opp)) {
            return PortfolioDecision.execute("No active position — passes execution gates");
        }

        if (opp.dominanceScore() >= queueMinDominance && passesAutoGates(opp)) {
            return PortfolioDecision.queue("Awaiting slot");
        }

        return PortfolioDecision.suppress(OrchestrationState.SUPPRESSED, "Not eligible for slot");
    }

    public boolean passesAutoGates(LiveTraderDtos.RankedOpportunityDto opp) {
        var intel = executionIntelligence.assess(opp);
        if (!intel.autoEntryAllowed()) return false;
        if (intel.adjustedDominance() < MIN_DOMINANCE) return false;
        if (intel.adjustedConviction() < MIN_CONVICTION) return false;
        if (opp.degrading()) return false;
        if (opp.conviction() < MIN_CONVICTION) return false;
        if (opp.dominanceScore() < MIN_DOMINANCE) return false;
        if (opp.persistenceSeconds() < MIN_PERSISTENCE) return false;
        if (opp.rvol() < MIN_RVOL) return false;
        if (!opp.marketAligned()) return false;
        if ("STALE".equals(opp.dataFreshness()) || "DELAYED".equals(opp.dataFreshness())) return false;

        String lifecycle = opp.tradeLifecycle() != null ? opp.tradeLifecycle().toUpperCase(Locale.US) : "";
        if (!lifecycle.equals(TradeLifecyclePhase.CONFIRMED.name())
                && !lifecycle.equals(TradeLifecyclePhase.PERSISTING.name())) {
            return false;
        }

        if (ExecutionQuality.LOW.name().equals(opp.executionQuality())) return false;

        String regime = opp.regime() != null ? opp.regime().toUpperCase(Locale.US) : "";
        return !regime.contains("EXHAUSTION") && !regime.contains("FAILED") && !regime.contains("CHOP");
    }

    private String marketRejectReason(LiveTraderDtos.RankedOpportunityDto opp, MarketHeartbeatDto market) {
        if (!executionIntelligence.macroAllowsRegime(opp.regime())) {
            return "Macro structure blocks " + opp.regime();
        }
        String intelBlock = executionIntelligence.autoEntryBlockReason(opp);
        if (intelBlock != null) return intelBlock;
        if (!ibkrClientService.isConnected()) return "IBKR disconnected";
        if (!ibkrClientService.isReadyForOrders()) return "IBKR not ready";
        if ("STALE".equals(opp.dataFreshness())) return "Stale quote";
        if ("DELAYED".equals(opp.dataFreshness())) return "Delayed data";
        if (opp.rvol() < MIN_RVOL) return "RVOL too low";
        if (!opp.marketAligned()) return "Weak market alignment";
        if (market != null && market.getMarketEmotion() != null) {
            String label = market.getMarketEmotion().getLabel();
            if (label != null && (label.toUpperCase(Locale.US).contains("CHOP")
                    || label.toUpperCase(Locale.US).contains("DEFENSIVE"))) {
                return "Market regime choppy";
            }
        }
        String regime = opp.regime() != null ? opp.regime().toUpperCase(Locale.US) : "";
        if (regime.contains("CHOP")) return "Opportunity regime choppy";
        return null;
    }

    private String qualityRejectReason(LiveTraderDtos.RankedOpportunityDto opp) {
        if (ExecutionQuality.LOW.name().equals(opp.executionQuality())) return "Execution quality LOW";
        if (opp.degrading()) return "Setup degrading";
        String lifecycle = opp.tradeLifecycle() != null ? opp.tradeLifecycle() : "";
        if (lifecycle.equals(TradeLifecyclePhase.FAILED.name())) return "Lifecycle FAILED";
        if (lifecycle.equals(TradeLifecyclePhase.EXHAUSTING.name())) return "Lifecycle exhausting";
        return null;
    }

    private boolean replacementAdvisory(PortfolioExposureModel active, LiveTraderDtos.RankedOpportunityDto incoming) {
        boolean dominanceDelta = incoming.dominanceScore() >= active.dominance() + 30;
        boolean convictionDelta = incoming.conviction() >= active.conviction() + 15;
        boolean incomingStrong = passesLifecycle(incoming.tradeLifecycle(), TradeLifecyclePhase.CONFIRMED, TradeLifecyclePhase.PERSISTING)
                && "ACCELERATING".equalsIgnoreCase(incoming.velocityTrend());
        boolean activeWeak = activeWeakLifecycle(active.lifecycle());
        return dominanceDelta && convictionDelta && incomingStrong && activeWeak;
    }

    private static boolean activeWeakLifecycle(String lifecycle) {
        if (lifecycle == null) return false;
        String l = lifecycle.toUpperCase(Locale.US);
        return l.contains("EXHAUST") || l.contains("FAILED") || l.contains("WEAK")
                || l.contains("REDUCE") || l.contains("DEVELOPING");
    }

    private static boolean passesLifecycle(String lifecycle, TradeLifecyclePhase... allowed) {
        if (lifecycle == null) return false;
        for (TradeLifecyclePhase p : allowed) {
            if (p.name().equalsIgnoreCase(lifecycle)) return true;
        }
        return false;
    }
}
