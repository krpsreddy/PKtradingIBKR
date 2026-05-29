package com.tradingbot.broker.registry;

import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.ibkr.SubscriptionManagerService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Durable subscription ledger — survives broker disconnects and profile switches.
 */
@Slf4j
@Component
public class SubscriptionRegistry {

    private static final int RESTORE_TICKER_BASE = 1;

    private final Map<String, SubscriptionRecord> bySymbol = new ConcurrentHashMap<>();
    private final AtomicInteger nextTickerId = new AtomicInteger(RESTORE_TICKER_BASE);

    public void register(String symbol, int tickerId, SubscriptionType type) {
        String sym = symbol.toUpperCase();
        bySymbol.put(sym, new SubscriptionRecord(sym, tickerId, type));
    }

    public void unregister(String symbol) {
        bySymbol.remove(symbol.toUpperCase());
    }

    public List<SubscriptionRecord> snapshot() {
        return List.copyOf(bySymbol.values());
    }

    public int size() {
        return bySymbol.size();
    }

    public void clear() {
        bySymbol.clear();
        nextTickerId.set(RESTORE_TICKER_BASE);
    }

    /** Sync from live IBKR + subscription manager maps before disconnect. */
    public void captureFrom(IBKRClientService ibkr, SubscriptionManagerService subscriptionManager) {
        bySymbol.clear();
        for (Map.Entry<String, Integer> e : ibkr.exportSymbolTickerMap().entrySet()) {
            register(e.getKey(), e.getValue(), SubscriptionType.MARKET_DATA);
        }
        for (String sym : subscriptionManager.exportSubscribedSymbols()) {
            if (!bySymbol.containsKey(sym)) {
                int id = subscriptionManager.tickerIdFor(sym).orElse(nextTickerId.getAndIncrement());
                register(sym, id, SubscriptionType.MARKET_DATA);
            }
        }
        log.info("SubscriptionRegistry captured {} symbols", bySymbol.size());
    }

    /** Re-subscribe all captured symbols after reconnect (non-blocking caller). */
    public int restoreAll(IBKRClientService ibkr, SubscriptionManagerService subscriptionManager) {
        if (!ibkr.isConnected()) {
            log.warn("Cannot restore subscriptions — IBKR not connected");
            return 0;
        }
        List<SubscriptionRecord> records = snapshot();
        int restored = 0;
        subscriptionManager.clearAll();
        nextTickerId.set(RESTORE_TICKER_BASE + records.size() + 10);

        for (SubscriptionRecord rec : records) {
            int tickerId = rec.tickerId() > 0 ? rec.tickerId() : nextTickerId.getAndIncrement();
            try {
                ibkr.subscribeToSymbol(rec.symbol(), tickerId);
                subscriptionManager.registerSubscription(rec.symbol(), tickerId);
                register(rec.symbol(), tickerId, rec.type());
                restored++;
                Thread.sleep(50);
            } catch (Exception ex) {
                log.warn("Failed restoring subscription for {}: {}", rec.symbol(), ex.getMessage());
            }
        }
        log.info("SubscriptionRegistry restored {}/{} streams", restored, records.size());
        return restored;
    }
}
