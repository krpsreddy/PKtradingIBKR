package com.tradingbot.livetrader.portfolio;

import java.util.Comparator;

/** Phase 189 — queue sort: dominance → quality → persistence → velocity → alignment. */
public final class OpportunityPriorityComparator {

    private OpportunityPriorityComparator() {}

    public static final Comparator<QueuedOpportunity> QUEUE_ORDER = Comparator
            .comparingInt(QueuedOpportunity::dominance).reversed()
            .thenComparing((QueuedOpportunity q) -> qualityRank(q.executionQuality())).reversed()
            .thenComparingInt(QueuedOpportunity::persistence).reversed()
            .thenComparingInt(OpportunityPriorityComparator::velocityScore).reversed()
            .thenComparing(q -> q.marketAligned() ? 1 : 0);

    private static int qualityRank(String q) {
        if (q == null) return 0;
        return switch (q.toUpperCase()) {
            case "INSTITUTIONAL" -> 4;
            case "HIGH" -> 3;
            case "MEDIUM" -> 2;
            default -> 1;
        };
    }

    private static int velocityScore(QueuedOpportunity q) {
        if ("ACCELERATING".equalsIgnoreCase(q.velocityTrend())) return 3;
        if ("FLATTENING".equalsIgnoreCase(q.velocityTrend())) return 1;
        return 0;
    }
}
