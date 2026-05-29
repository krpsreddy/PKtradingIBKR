package com.tradingbot.intelligence.live.runtime;

import com.tradingbot.intelligence.live.BackgroundHydrationOrchestrator;
import com.tradingbot.intelligence.live.MarketSessionClock;
import com.tradingbot.replay.ReplayRuntimeMode;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.services.SymbolLoadService;
import com.tradingbot.repository.TradingSymbolRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Phase 191 — lightweight one-time bootstrap for live execution runtime.
 * Replaces continuous promoteHigh hydration on scanner ticks.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuntimeBootstrapService {

    private final LiveRuntimeProperties properties;
    private final RuntimeBootstrapCache cache;
    private final MarketSessionClock sessionClock;
    private final SymbolLoadService symbolLoadService;
    private final IBKRClientService ibkrClientService;
    private final TradingSymbolRepository symbolRepository;
    private final BackgroundHydrationOrchestrator hydrationOrchestrator;
    private final ReplayRuntimeMode replayRuntimeMode;

    private final AtomicReference<String> activeSessionKey = new AtomicReference<>("");

    @PostConstruct
    void init() {
        hydrationOrchestrator.setEnabled(properties.isResearchHydrationEnabled());
        activeSessionKey.set(sessionClock.sessionDayKey());
        log.info("Live runtime bootstrap enabled={} researchHydration={} refreshMin={}",
                properties.isBootstrapEnabled(),
                properties.isResearchHydrationEnabled(),
                properties.getBootstrapRefreshMinutes());
    }

    /** Symbol activated in watchlist — bootstrap once per session if needed. */
    public void ensureBootstrapped(String symbol) {
        if (replayRuntimeMode.isReplayActive() || !properties.isBootstrapEnabled()) {
            return;
        }
        watchSessionBoundary();
        String sym = symbol.toUpperCase(Locale.US);
        String sessionId = sessionClock.sessionDayKey();
        if (!cache.needsBootstrap(sym, sessionId)) {
            return;
        }
        if (!ibkrClientService.isConnected()) {
            return;
        }
        log.info("Runtime bootstrap (once) {} session={}", sym, sessionId);
        symbolLoadService.activateSymbol(sym);
        if (symbolLoadService.hasHistoricalData(sym)) {
            cache.markLoaded(sym, sessionId);
        }
    }

    /** IBKR reconnect — single recovery pass for live subscribe symbols. */
    public void onReconnectRecovery() {
        if (replayRuntimeMode.isReplayActive()
                || !properties.isBootstrapEnabled()
                || !ibkrClientService.isConnected()) {
            return;
        }
        log.info("Runtime bootstrap reconnect recovery");
        var symbols = symbolRepository.findByActiveTrueAndEnabledTrueAndSubscribeLiveTrueOrderByDisplayOrderAscSymbolAsc();
        for (var row : symbols) {
            String sym = row.getSymbol().toUpperCase(Locale.US);
            cache.clear(sym);
            ensureBootstrapped(sym);
        }
    }

    /** Optional research-only async enrichment (never blocks scanner). */
    public void enqueueResearchHydration(String symbol) {
        if (replayRuntimeMode.isReplayActive() || !properties.isResearchHydrationEnabled()) {
            return;
        }
        hydrationOrchestrator.queueLow(symbol);
    }

    @Scheduled(fixedRate = 60_000, initialDelay = 30_000)
    void watchSessionBoundary() {
        String key = sessionClock.sessionDayKey();
        String prev = activeSessionKey.get();
        if (prev != null && !prev.isBlank() && sessionClock.sessionChanged(prev)) {
            log.info("Session boundary {} → {} — reset runtime bootstrap markers", prev, key);
            cache.onNewSession(key);
        }
        activeSessionKey.set(key);
    }

    /** Optional periodic lightweight refresh (not per scanner tick). */
    @Scheduled(fixedRate = 300_000, initialDelay = 300_000)
    void periodicStructureRefresh() {
        if (replayRuntimeMode.isReplayActive()) {
            return;
        }
        int minutes = properties.getBootstrapRefreshMinutes();
        if (minutes <= 0 || !properties.isBootstrapEnabled()) {
            return;
        }
        if (!ibkrClientService.isConnected()) {
            return;
        }
        long maxAgeMs = minutes * 60_000L;
        String sessionId = sessionClock.sessionDayKey();
        long now = System.currentTimeMillis();
        for (var row : symbolRepository.findByActiveTrueAndEnabledTrueAndSubscribeLiveTrueOrderByDisplayOrderAscSymbolAsc()) {
            String sym = row.getSymbol().toUpperCase(Locale.US);
            var state = cache.stateFor(sym);
            if (state != null && state.loaded() && state.loadedAtMs() > 0
                    && now - state.loadedAtMs() < maxAgeMs
                    && sessionId.equals(state.sessionId())) {
                continue;
            }
            log.info("Runtime bootstrap periodic refresh {}", sym);
            cache.clear(sym);
            ensureBootstrapped(sym);
        }
    }
}
