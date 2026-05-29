package com.tradingbot.livetrader.portfolio;

/** Result of portfolio decision engine for one opportunity. */
public record PortfolioDecision(
        OrchestrationState state,
        String reason,
        boolean eligibleForExecution,
        boolean replacementAdvisory
) {
    public static PortfolioDecision execute(String reason) {
        return new PortfolioDecision(OrchestrationState.ACTIVE, reason, true, false);
    }

    public static PortfolioDecision queue(String reason) {
        return new PortfolioDecision(OrchestrationState.QUEUE, reason, false, false);
    }

    public static PortfolioDecision suppress(OrchestrationState state, String reason) {
        return new PortfolioDecision(state, reason, false, false);
    }

    public static PortfolioDecision replacement(String reason) {
        return new PortfolioDecision(OrchestrationState.REPLACEMENT_CANDIDATE, reason, false, true);
    }
}
