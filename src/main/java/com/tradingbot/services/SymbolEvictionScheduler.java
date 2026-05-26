package com.tradingbot.services;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.ibkr.SubscriptionManagerService;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class SymbolEvictionScheduler {

    private final SymbolContextRegistry symbolContextRegistry;
    private final SubscriptionManagerService subscriptionManager;
    private final TradingProperties tradingProperties;
    private final TradingSymbolService tradingSymbolService;

    @Scheduled(fixedRateString = "${trading.eviction-check-ms:300000}")
    public void evictInactiveSymbols() {
        Instant cutoffInstant = Instant.now().minus(Duration.ofMinutes(tradingProperties.getSymbolIdleEvictMinutes()));
        LocalDateTime cutoffLocal = LocalDateTime.now().minusMinutes(tradingProperties.getSymbolIdleEvictMinutes());
        Set<String> managedSymbols = tradingSymbolService.getEnabledSymbolSet();
        List<String> toEvict = new ArrayList<>();

        for (SymbolContext ctx : symbolContextRegistry.all()) {
            String sym = ctx.getSymbol();
            if (managedSymbols.contains(sym)) {
                continue;
            }
            if (tradingSymbolService.findActive(sym).map(s -> s.isPinned()).orElse(false)) {
                continue;
            }
            if (tradingSymbolService.isRecentlyViewed(sym, cutoffLocal)) {
                continue;
            }
            Instant lastAccess = ctx.getLastAccessedAt();
            if (lastAccess != null && lastAccess.isBefore(cutoffInstant)) {
                toEvict.add(sym);
            }
        }

        for (String sym : toEvict) {
            subscriptionManager.unsubscribe(sym);
            symbolContextRegistry.evict(sym);
            log.info("Evicted inactive symbol {}", sym);
        }
    }
}
