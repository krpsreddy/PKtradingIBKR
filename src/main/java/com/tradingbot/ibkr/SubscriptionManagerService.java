package com.tradingbot.ibkr;

import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
public class SubscriptionManagerService {

    private static final int ON_DEMAND_TICKER_BASE = 100;

    private final IBKRClientService ibkrClientService;
    private final SymbolContextRegistry symbolContextRegistry;

    private final Map<String, Integer> symbolToTickerId = new ConcurrentHashMap<>();
    private final AtomicInteger nextTickerId = new AtomicInteger(ON_DEMAND_TICKER_BASE);

    public SubscriptionManagerService(@Lazy IBKRClientService ibkrClientService,
                                      SymbolContextRegistry symbolContextRegistry) {
        this.ibkrClientService = ibkrClientService;
        this.symbolContextRegistry = symbolContextRegistry;
    }

    public boolean subscribeIfNeeded(String symbol) {
        String sym = symbol.toUpperCase();
        if (symbolToTickerId.containsKey(sym) || ibkrClientService.isSubscribed(sym)) {
            log.debug("Already subscribed to {}", sym);
            symbolContextRegistry.markSubscribed(sym);
            return false;
        }
        if (!ibkrClientService.isConnected()) {
            log.warn("Cannot subscribe to {} — IBKR not connected", sym);
            return false;
        }
        int tickerId = nextTickerId.getAndIncrement();
        symbolToTickerId.put(sym, tickerId);
        ibkrClientService.subscribeToSymbol(sym, tickerId);
        symbolContextRegistry.markSubscribed(sym);
        return true;
    }

    public boolean isSubscribed(String symbol) {
        String sym = symbol.toUpperCase();
        return symbolToTickerId.containsKey(sym) || ibkrClientService.isSubscribed(sym);
    }

    /** Register ticker IDs assigned during startup batch subscribe. */
    public void registerSubscription(String symbol, int tickerId) {
        symbolToTickerId.put(symbol.toUpperCase(), tickerId);
        symbolContextRegistry.markSubscribed(symbol);
    }

    public void clearAll() {
        symbolToTickerId.clear();
    }

    public int subscriptionCount() {
        return symbolToTickerId.size();
    }

    public void unsubscribe(String symbol) {
        String sym = symbol.toUpperCase();
        Integer tickerId = symbolToTickerId.remove(sym);
        if (tickerId != null) {
            ibkrClientService.cancelSymbolSubscription(sym, tickerId);
            SymbolContext ctx = symbolContextRegistry.get(sym);
            if (ctx != null) {
                ctx.setLiveSubscribed(false);
                ctx.invalidateCache();
            }
            log.info("Unsubscribed IBKR stream for {}", sym);
        }
    }
}
