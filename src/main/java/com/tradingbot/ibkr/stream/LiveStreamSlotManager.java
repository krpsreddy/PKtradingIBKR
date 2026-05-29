package com.tradingbot.ibkr.stream;

import com.tradingbot.config.IBKRProperties;
import com.tradingbot.ibkr.SubscriptionManagerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Phase 194 — applies tier decisions to IBKR subscriptions (realtime slots only).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LiveStreamSlotManager {

    /** Phase 219 — pace reqMktData to avoid IBKR line-rate violations during reconcile. */
    private static final long SUBSCRIBE_PACING_MS = 250;

    private final IBKRProperties ibkrProperties;
    private final LiveStreamProperties streamProperties;
    private final SubscriptionManagerService subscriptionManager;

    private final Map<String, SymbolStreamAllocation> allocations = new ConcurrentHashMap<>();
    private final List<String> promotionQueue = new ArrayList<>();
    private final List<String> demotionQueue = new ArrayList<>();

    public void apply(List<SymbolStreamAllocation> desired) {
        Map<String, SymbolStreamAllocation> prev = Map.copyOf(allocations);
        allocations.clear();
        promotionQueue.clear();
        demotionQueue.clear();

        List<String> realtimeOrder = desired.stream()
                .filter(a -> a.tier() == LiveStreamTier.REALTIME)
                .sorted(Comparator.comparingInt(SymbolStreamAllocation::priorityScore).reversed())
                .map(SymbolStreamAllocation::symbol)
                .toList();

        int maxRt = ibkrProperties.getMaxLiveStreams() > 0
                ? ibkrProperties.getMaxLiveStreams()
                : realtimeOrder.size();

        Map<String, SymbolStreamAllocation> next = new LinkedHashMap<>();
        for (SymbolStreamAllocation a : desired) {
            LiveStreamTier tier = a.tier();
            StreamAllocationReason reason = a.reason();

            if (tier == LiveStreamTier.REALTIME) {
                int rtIndex = realtimeOrder.indexOf(a.symbol());
                if (rtIndex < 0 || rtIndex >= maxRt) {
                    tier = LiveStreamTier.SNAPSHOT;
                    reason = StreamAllocationReason.LOW_PRIORITY;
                }
            }

            boolean subscribed = false;
            SymbolStreamAllocation prevAlloc = prev.get(a.symbol());
            LiveStreamTier prevTier = prevAlloc != null ? prevAlloc.tier() : LiveStreamTier.DORMANT;

            if (tier == LiveStreamTier.REALTIME) {
                if (prevTier != LiveStreamTier.REALTIME) {
                    promotionQueue.add(a.symbol());
                }
                subscribed = subscriptionManager.subscribeIfNeeded(a.symbol());
            } else if (prevTier == LiveStreamTier.REALTIME || subscriptionManager.isSubscribed(a.symbol())) {
                demotionQueue.add(a.symbol());
                subscriptionManager.unsubscribe(a.symbol());
            }

            if (tier == LiveStreamTier.QUEUED_FOR_PROMOTION || tier == LiveStreamTier.PENDING_UNSUBSCRIBE) {
                // resolved above
            }

            next.put(
                    a.symbol(),
                    new SymbolStreamAllocation(
                            a.symbol(),
                            subscribed ? LiveStreamTier.REALTIME : tier,
                            reason,
                            a.priorityScore(),
                            a.dominanceScore(),
                            a.lifecycle(),
                            subscribed
                    )
            );
        }

        for (String sym : prev.keySet()) {
            if (!next.containsKey(sym) && subscriptionManager.isSubscribed(sym)) {
                demotionQueue.add(sym);
                subscriptionManager.unsubscribe(sym);
            }
        }

        allocations.putAll(next);

        if (!promotionQueue.isEmpty() || !demotionQueue.isEmpty()) {
            log.debug(
                    "Stream rotation promoted={} demoted={} realtime={}/{}",
                    promotionQueue.size(),
                    demotionQueue.size(),
                    realtimeCount(),
                    maxRt
            );
        }
    }

    public Map<String, SymbolStreamAllocation> allocations() {
        return Map.copyOf(allocations);
    }

    public List<String> promotionQueue() {
        return List.copyOf(promotionQueue);
    }

    public List<String> demotionQueue() {
        return List.copyOf(demotionQueue);
    }

    public int realtimeCount() {
        return (int) allocations.values().stream()
                .filter(a -> a.ibkrSubscribed() || a.tier() == LiveStreamTier.REALTIME)
                .filter(SymbolStreamAllocation::ibkrSubscribed)
                .count();
    }

    public List<String> realtimeSymbols() {
        return allocations.values().stream()
                .filter(SymbolStreamAllocation::ibkrSubscribed)
                .map(SymbolStreamAllocation::symbol)
                .sorted()
                .toList();
    }

    public List<String> symbolsByTier(LiveStreamTier tier) {
        return allocations.values().stream()
                .filter(a -> a.tier() == tier || (tier == LiveStreamTier.REALTIME && a.ibkrSubscribed()))
                .map(SymbolStreamAllocation::symbol)
                .sorted()
                .toList();
    }

    public void clear() {
        allocations.clear();
        promotionQueue.clear();
        demotionQueue.clear();
    }

    /** Priority-ordered restore after reconnect (does not exceed max slots). */
    public int restoreByPriority(List<SymbolStreamAllocation> priorityOrder) {
        if (!streamProperties.isDynamicEnabled()) {
            return 0;
        }
        List<SymbolStreamAllocation> sorted = priorityOrder.stream()
                .sorted(Comparator.comparingInt(SymbolStreamAllocation::priorityScore).reversed())
                .toList();
        apply(sorted);
        return realtimeCount();
    }

    private static void pause(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
