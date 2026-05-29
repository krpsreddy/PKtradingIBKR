package com.tradingbot.ibkr;

import com.tradingbot.broker.registry.SubscriptionRegistry;
import com.tradingbot.broker.registry.SubscriptionType;
import com.tradingbot.config.IBKRProperties;
import com.tradingbot.ibkr.connection.VerifiedStreamRegistry;
import com.tradingbot.ibkr.diagnostics.StreamPipelineDiagnostics;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
public class SubscriptionManagerService {

    private static final int ON_DEMAND_TICKER_BASE = 100;

    private final IBKRProperties ibkrProperties;
    private final IBKRClientService ibkrClientService;
    private final SymbolContextRegistry symbolContextRegistry;
    private final SubscriptionRegistry subscriptionRegistry;
    private final VerifiedStreamRegistry verifiedStreamRegistry;
    private final StreamPipelineDiagnostics streamDiagnostics;

    private final Map<String, Integer> symbolToTickerId = new ConcurrentHashMap<>();
    private final AtomicInteger nextTickerId = new AtomicInteger(ON_DEMAND_TICKER_BASE);
    private final AtomicBoolean tickerCapReached = new AtomicBoolean(false);
    private final AtomicBoolean tickerCapLogged = new AtomicBoolean(false);

    public SubscriptionManagerService(IBKRProperties ibkrProperties,
                                      @Lazy IBKRClientService ibkrClientService,
                                      SymbolContextRegistry symbolContextRegistry,
                                      SubscriptionRegistry subscriptionRegistry,
                                      VerifiedStreamRegistry verifiedStreamRegistry,
                                      StreamPipelineDiagnostics streamDiagnostics) {
        this.ibkrProperties = ibkrProperties;
        this.ibkrClientService = ibkrClientService;
        this.symbolContextRegistry = symbolContextRegistry;
        this.subscriptionRegistry = subscriptionRegistry;
        this.verifiedStreamRegistry = verifiedStreamRegistry;
        this.streamDiagnostics = streamDiagnostics;
    }

    public void onTickerCapReached() {
        tickerCapReached.set(true);
    }

    public boolean subscribeIfNeeded(String symbol) {
        String sym = symbol.toUpperCase();
        if (symbolToTickerId.containsKey(sym) || ibkrClientService.isSubscribed(sym)) {
            log.debug("Already subscribed to {}", sym);
            symbolContextRegistry.markSubscribed(sym);
            return false;
        }
        if (!ibkrClientService.isConnected()) {
            log.debug("Cannot subscribe to {} — IBKR not connected", sym);
            streamDiagnostics.recordSubscriptionAttempt(sym, false, "not connected");
            return false;
        }
        if (!ibkrClientService.isIbkrReady()) {
            log.debug("Cannot subscribe to {} — IBKR not ready", sym);
            streamDiagnostics.recordSubscriptionAttempt(sym, false, "not ready");
            return false;
        }
        int max = ibkrProperties.getMaxLiveStreams();
        if (tickerCapReached.get() || (max > 0 && activeStreamCount() >= max)) {
            if (tickerCapLogged.compareAndSet(false, true)) {
                log.warn(
                        "IBKR live stream cap reached ({}) — further subscribeLive symbols use DB/historical only",
                        max > 0 ? max : "broker limit"
                );
            } else {
                log.debug("Skipping live subscribe for {} — stream cap reached", sym);
            }
            return false;
        }
        int tickerId = nextTickerId.getAndIncrement();
        if (!ibkrClientService.subscribeToSymbol(sym, tickerId)) {
            streamDiagnostics.recordSubscriptionAttempt(sym, false, "subscribe rejected");
            return false;
        }
        symbolToTickerId.put(sym, tickerId);
        verifiedStreamRegistry.onSubscribeRequested(sym);
        subscriptionRegistry.register(sym, tickerId, SubscriptionType.MARKET_DATA);
        symbolContextRegistry.markSubscribed(sym);
        return true;
    }

    public boolean isSubscribed(String symbol) {
        return symbolToTickerId.containsKey(symbol.toUpperCase());
    }

    /** Register ticker IDs assigned during startup batch subscribe. */
    public void registerSubscription(String symbol, int tickerId) {
        String sym = symbol.toUpperCase();
        symbolToTickerId.put(sym, tickerId);
        subscriptionRegistry.register(sym, tickerId, SubscriptionType.MARKET_DATA);
        symbolContextRegistry.markSubscribed(symbol);
    }

    public Set<String> exportSubscribedSymbols() {
        return Set.copyOf(symbolToTickerId.keySet());
    }

    public Optional<Integer> tickerIdFor(String symbol) {
        return Optional.ofNullable(symbolToTickerId.get(symbol.toUpperCase()));
    }

    public void clearAll() {
        for (String sym : List.copyOf(symbolToTickerId.keySet())) {
            unsubscribe(sym);
        }
        symbolToTickerId.clear();
        verifiedStreamRegistry.clearAll();
        nextTickerId.set(ON_DEMAND_TICKER_BASE);
        tickerCapReached.set(false);
        tickerCapLogged.set(false);
    }

    /** Registry allocation count (may include ghosts before tick verification). */
    public int registrySubscriptionCount() {
        return activeStreamCount();
    }

    public int subscriptionCount() {
        return activeStreamCount();
    }

    private int activeStreamCount() {
        return symbolToTickerId.size();
    }

    public void unsubscribe(String symbol) {
        String sym = symbol.toUpperCase();
        Integer tickerId = symbolToTickerId.remove(sym);
        if (tickerId != null) {
            ibkrClientService.cancelSymbolSubscription(sym, tickerId);
            verifiedStreamRegistry.onUnsubscribed(sym);
            subscriptionRegistry.unregister(sym);
            SymbolContext ctx = symbolContextRegistry.get(sym);
            if (ctx != null) {
                ctx.setLiveSubscribed(false);
                ctx.invalidateCache();
            }
            streamDiagnostics.recordUnsubscribe(sym, "orchestrator");
            log.info("Unsubscribed IBKR stream for {}", sym);
        }
    }

    /** Remove registry rows that never received reqMktData (failed early subscribe). */
    public int pruneOrphanRegistryEntries() {
        int pruned = 0;
        for (String sym : List.copyOf(symbolToTickerId.keySet())) {
            if (!ibkrClientService.isSubscribed(sym)) {
                symbolToTickerId.remove(sym);
                verifiedStreamRegistry.clearGhost(sym);
                subscriptionRegistry.unregister(sym);
                pruned++;
            }
        }
        return pruned;
    }
}
