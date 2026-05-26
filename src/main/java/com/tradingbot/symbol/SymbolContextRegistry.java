package com.tradingbot.symbol;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class SymbolContextRegistry {

    private final Map<String, SymbolContext> contexts = new ConcurrentHashMap<>();

    public SymbolContext getOrCreate(String symbol) {
        SymbolContext ctx = contexts.computeIfAbsent(symbol.toUpperCase(), SymbolContext::new);
        ctx.setLastAccessedAt(Instant.now());
        return ctx;
    }

    public void touch(String symbol) {
        SymbolContext ctx = contexts.get(symbol.toUpperCase());
        if (ctx != null) {
            ctx.setLastAccessedAt(Instant.now());
        }
    }

    public void updateOpenReadinessState(String symbol, String openReadinessState) {
        SymbolContext ctx = getOrCreate(symbol);
        ctx.setOpenReadinessState(openReadinessState != null ? openReadinessState : "");
        ctx.setLastUpdate(Instant.now());
    }

    public void updateReadinessState(String symbol, String readinessState) {
        SymbolContext ctx = getOrCreate(symbol);
        ctx.setReadinessState(readinessState != null ? readinessState : "");
        ctx.setLastUpdate(Instant.now());
    }

    public void updateSignalState(String symbol, String signalType, String lifecycleState) {
        SymbolContext ctx = getOrCreate(symbol);
        ctx.setSignalState(signalType);
        ctx.setLifecycleState(lifecycleState);
        ctx.setLastUpdate(Instant.now());
    }

    public void evict(String symbol) {
        SymbolContext removed = contexts.remove(symbol.toUpperCase());
        if (removed != null) {
            removed.invalidateCache();
            log.info("Evicted symbol context for {}", symbol);
        }
    }

    public com.tradingbot.api.dto.CacheMetricsDto cacheMetrics(int subscriptionCount) {
        int cached = (int) contexts.values().stream().filter(SymbolContext::hasValidCache).count();
        long memKb = contexts.values().stream()
                .mapToLong(ctx -> ctx.getCachedCandles().size() * 128L + 512L)
                .sum() / 1024L;
        return com.tradingbot.api.dto.CacheMetricsDto.builder()
                .activeSymbols(contexts.size())
                .cachedSymbols(cached)
                .ibkrSubscriptions(subscriptionCount)
                .estimatedMemoryKb(memKb)
                .build();
    }

    public SymbolContext get(String symbol) {
        return contexts.get(symbol.toUpperCase());
    }

    public Collection<SymbolContext> all() {
        return contexts.values();
    }

    public void markHistoricalLoaded(String symbol) {
        SymbolContext ctx = getOrCreate(symbol);
        ctx.setHistoricalLoaded(true);
        ctx.setLoadingHistorical(false);
        ctx.setLastUpdate(Instant.now());
        log.info("Historical loaded for {}", symbol);
    }

    public void markLoading(String symbol) {
        SymbolContext ctx = getOrCreate(symbol);
        ctx.setLoadingHistorical(true);
    }

    public void markSubscribed(String symbol) {
        SymbolContext ctx = getOrCreate(symbol);
        ctx.setLiveSubscribed(true);
        ctx.setLastUpdate(Instant.now());
        log.info("Subscribed live stream for {}", symbol);
    }

    public void markCached(String symbol) {
        SymbolContext ctx = getOrCreate(symbol);
        ctx.setHistoricalLoaded(true);
        ctx.setLoadingHistorical(false);
        log.info("Using cached candles for {}", symbol);
    }
}
