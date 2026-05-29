package com.tradingbot.livetrader.portfolio;

import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.livetrader.execution.TradeLifecyclePhase;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/** Phase 189 — in-memory opportunity queue with TTL expiration. */
@Component
public class OpportunityQueueService {

    private final CorrelationSuppressionEngine correlationEngine;

    @Value("${live-trader.portfolio.queue-ttl-minutes:15}")
    private int queueTtlMinutes;

    @Value("${live-trader.portfolio.queue-min-dominance:100}")
    private int expireDominanceBelow;

    private final Map<String, QueuedOpportunity> bySymbol = new ConcurrentHashMap<>();

    public OpportunityQueueService(CorrelationSuppressionEngine correlationEngine) {
        this.correlationEngine = correlationEngine;
    }

    public void upsert(LiveTraderDtos.RankedOpportunityDto opp, PortfolioDecision decision) {
        if (decision.state() == OrchestrationState.EXPIRED) {
            bySymbol.remove(opp.symbol().toUpperCase());
            return;
        }
        QueuedOpportunity q = toQueued(opp, decision.state(), decision.reason());
        bySymbol.put(opp.symbol().toUpperCase(), q);
    }

    public void expireStale(List<LiveTraderDtos.RankedOpportunityDto> currentRanked) {
        Instant cutoff = Instant.now().minusSeconds(queueTtlMinutes * 60L);
        Map<String, LiveTraderDtos.RankedOpportunityDto> rankedMap = currentRanked.stream()
                .collect(Collectors.toMap(o -> o.symbol().toUpperCase(), o -> o, (a, b) -> a));

        List<String> remove = new ArrayList<>();
        for (var e : bySymbol.entrySet()) {
            QueuedOpportunity q = e.getValue();
            if (q.queuedAt().isBefore(cutoff)) {
                remove.add(e.getKey());
                continue;
            }
            LiveTraderDtos.RankedOpportunityDto live = rankedMap.get(e.getKey());
            if (live == null) {
                remove.add(e.getKey());
                continue;
            }
            if (live.dominanceScore() < expireDominanceBelow) {
                remove.add(e.getKey());
                continue;
            }
            if (TradeLifecyclePhase.FAILED.name().equalsIgnoreCase(live.tradeLifecycle())) {
                remove.add(e.getKey());
            }
        }
        remove.forEach(bySymbol::remove);
    }

    public void clearNonQueueStates() {
        bySymbol.entrySet().removeIf(e -> e.getValue().state() != OrchestrationState.QUEUE);
    }

    public List<QueuedOpportunity> byState(OrchestrationState state) {
        return bySymbol.values().stream()
                .filter(q -> q.state() == state)
                .sorted(OpportunityPriorityComparator.QUEUE_ORDER)
                .toList();
    }

    public List<QueuedOpportunity> all() {
        return bySymbol.values().stream()
                .sorted(Comparator.comparing(QueuedOpportunity::state)
                        .thenComparing(OpportunityPriorityComparator.QUEUE_ORDER))
                .toList();
    }

    public void remove(String symbol) {
        if (symbol != null) {
            bySymbol.remove(symbol.toUpperCase());
        }
    }

    private QueuedOpportunity toQueued(LiveTraderDtos.RankedOpportunityDto opp, OrchestrationState state, String reason) {
        String existingKey = opp.symbol().toUpperCase();
        Instant queuedAt = bySymbol.containsKey(existingKey)
                ? bySymbol.get(existingKey).queuedAt()
                : Instant.now();
        if (state != OrchestrationState.QUEUE) {
            queuedAt = Instant.now();
        }
        return new QueuedOpportunity(
                opp.symbol(),
                opp.regime(),
                state,
                reason,
                opp.conviction(),
                opp.dominanceScore(),
                opp.persistenceSeconds(),
                opp.rvol(),
                opp.executionQuality(),
                opp.tradeLifecycle(),
                opp.velocityTrend(),
                opp.marketAligned(),
                correlationEngine.clusterFor(opp.symbol()),
                queuedAt,
                System.currentTimeMillis()
        );
    }
}
