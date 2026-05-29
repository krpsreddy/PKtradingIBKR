package com.tradingbot.intelligence.live;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Hot-start in-memory cache — no DB reads on scan ticks. */
@Component
public class LiveScannerRollingCache {

    private final MarketSessionClock sessionClock;
    private final Map<String, LiveSymbolScanState> bySymbol = new ConcurrentHashMap<>();
    private volatile String activeSessionKey = "";

    public LiveScannerRollingCache(MarketSessionClock sessionClock) {
        this.sessionClock = sessionClock;
    }

    public LiveSymbolScanState stateFor(String symbol) {
        ensureSession();
        return bySymbol.computeIfAbsent(symbol.toUpperCase(), s -> new LiveSymbolScanState());
    }

    public void ensureSession() {
        String key = sessionClock.sessionDayKey();
        if (sessionClock.sessionChanged(activeSessionKey)) {
            activeSessionKey = key;
            for (LiveSymbolScanState st : bySymbol.values()) {
                st.resetForSession(key);
            }
        }
    }

    public void clearSymbol(String symbol) {
        bySymbol.remove(symbol.toUpperCase());
    }

    public Map<String, LiveSymbolScanState> allStates() {
        ensureSession();
        return Map.copyOf(bySymbol);
    }
}
