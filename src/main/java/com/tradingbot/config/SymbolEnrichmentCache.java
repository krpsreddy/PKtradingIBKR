package com.tradingbot.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.tradingbot.api.dto.TradingSymbolDto;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

/** Short-TTL cache for per-symbol watchlist enrichment (reduces N+1 load). */
@Component
public class SymbolEnrichmentCache {

    private final Cache<String, TradingSymbolDto> cache = Caffeine.newBuilder()
            .maximumSize(500)
            .expireAfterWrite(Duration.ofSeconds(5))
            .build();

    public Optional<TradingSymbolDto> get(String symbol) {
        return Optional.ofNullable(cache.getIfPresent(symbol.toUpperCase()));
    }

    public void put(String symbol, TradingSymbolDto dto) {
        cache.put(symbol.toUpperCase(), dto);
    }

    public void invalidate(String symbol) {
        cache.invalidate(symbol.toUpperCase());
    }

    public void invalidateAll() {
        cache.invalidateAll();
    }
}
