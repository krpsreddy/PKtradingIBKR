package com.tradingbot.intelligence.live.runtime;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Phase 191 — tracks one-time runtime bootstrap per symbol + session. */
@Component
public class RuntimeBootstrapCache {

    public record BootstrapState(
            boolean loaded,
            long loadedAtMs,
            String sessionId
    ) {}

    private final Map<String, BootstrapState> bySymbol = new ConcurrentHashMap<>();

    public boolean needsBootstrap(String symbol, String sessionId) {
        String sym = symbol.toUpperCase();
        BootstrapState state = bySymbol.get(sym);
        if (state == null) {
            return true;
        }
        if (!state.loaded()) {
            return true;
        }
        return sessionId == null || !sessionId.equals(state.sessionId());
    }

    public void markLoaded(String symbol, String sessionId) {
        String sym = symbol.toUpperCase();
        bySymbol.put(sym, new BootstrapState(true, System.currentTimeMillis(), sessionId));
    }

    public BootstrapState stateFor(String symbol) {
        return bySymbol.get(symbol.toUpperCase());
    }

    /** New RTH session — drop carryover bootstrap markers. */
    public void onNewSession(String sessionId) {
        bySymbol.replaceAll((sym, prev) -> new BootstrapState(false, 0, sessionId));
    }

    public void clear(String symbol) {
        bySymbol.remove(symbol.toUpperCase());
    }
}
