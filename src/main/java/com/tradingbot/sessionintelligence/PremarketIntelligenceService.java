package com.tradingbot.sessionintelligence;

import com.tradingbot.intelligence.live.MarketSessionClock;
import com.tradingbot.sessionintelligence.context.PremarketCandleRollingStore;
import com.tradingbot.sessionintelligence.premarket.PremarketIntelligenceEngine;
import com.tradingbot.sessionintelligence.premarket.PremarketSnapshotDto;
import com.tradingbot.sessionintelligence.premarket.PremarketTrendState;
import com.tradingbot.sessionintelligence.session.OpenTransitionEngine;
import com.tradingbot.sessionintelligence.session.PremarketSessionWindow;
import com.tradingbot.sessionintelligence.telemetry.PremarketIntelligenceTelemetryService;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Phase 211 — cached PM snapshots + integration modifiers. */
@Slf4j
@Service
@RequiredArgsConstructor
public class PremarketIntelligenceService {

    private final PremarketIntelligenceProperties properties;
    private final PremarketIntelligenceEngine engine;
    private final PremarketCandleRollingStore candleStore;
    private final PremarketSessionWindow sessionWindow;
    private final MarketSessionClock sessionClock;
    private final SymbolContextRegistry symbolContextRegistry;
    private final PremarketIntelligenceTelemetryService telemetryService;

    private final Map<String, PremarketSnapshotDto> cache = new ConcurrentHashMap<>();
    private volatile OpenTransitionEngine.OpenTransition lastMarketTransition;

    public boolean enabled() {
        return properties.isEnabled();
    }

    public Optional<PremarketSnapshotDto> get(String symbol) {
        if (!enabled() || symbol == null) return Optional.empty();
        return Optional.ofNullable(cache.get(symbol.toUpperCase()));
    }

    public Collection<PremarketSnapshotDto> allSnapshots() {
        return cache.values();
    }

    public void refreshSymbol(String symbol) {
        if (!enabled()) return;
        SymbolContext ctx = symbolContextRegistry.getOrCreate(symbol);
        candleStore.resetIfSessionChanged(sessionClock.sessionDayKey());
        var pmBars = candleStore.bars(symbol);
        PremarketSnapshotDto snap = engine.build(symbol, ctx, pmBars);
        cache.put(symbol.toUpperCase(), snap);
        if (sessionWindow.isActivePremarketIntelligenceWindow()) {
            telemetryService.recordAsync(snap, null);
        }
    }

    public void ingestCandles(String symbol, java.util.List<com.tradingbot.models.Candle> candles) {
        if (!sessionWindow.isActivePremarketIntelligenceWindow()) return;
        candleStore.resetIfSessionChanged(sessionClock.sessionDayKey());
        candleStore.ingest(symbol, candles);
    }

    /** Bullish conviction modifier from PM + open transition. */
    public int bullishModifier(String symbol) {
        var pm = get(symbol);
        if (pm.isEmpty()) return 0;
        PremarketSnapshotDto s = pm.get();
        int mod = 0;
        if (s.premarketQualityScore() >= 65
                && (s.trendState() == PremarketTrendState.HEALTHY_CONTINUATION
                || s.trendState() == PremarketTrendState.EARLY_EXPANSION)) {
            mod += 8;
        }
        if (s.trendState() == PremarketTrendState.PARABOLIC_EXTENSION
                || s.trendState() == PremarketTrendState.DISTRIBUTION) {
            mod -= 12;
        }
        if (s.premarketReclaimFailure()) mod -= 10;

        OpenTransitionEngine.OpenTransition ot = openTransition(symbol);
        if (ot != null) mod += ot.continuationBoost();
        return mod;
    }

    /** Bearish PUT assist modifier. */
    public int bearishModifier(String symbol) {
        var pm = get(symbol);
        if (pm.isEmpty()) return 0;
        PremarketSnapshotDto s = pm.get();
        int mod = 0;
        if (OpenTransitionEngine.isBearishPm(s.trendState())) mod += 15;
        if (s.premarketReclaimFailure()) mod += 10;
        if (s.premarketDistribution()) mod += 8;
        OpenTransitionEngine.OpenTransition ot = openTransition(symbol);
        if (ot != null) mod += ot.bearishBoost();
        return mod;
    }

    public int squeezeRiskAdjustment(String symbol) {
        return get(symbol).map(PremarketSnapshotDto::squeezeRisk).orElse(0);
    }

    public OpenTransitionEngine.OpenTransition openTransition(String symbol) {
        var pm = get(symbol);
        if (pm.isEmpty()) return null;
        SymbolContext ctx = symbolContextRegistry.get(symbol);
        double last = ctx != null && ctx.getLastPrice() != null ? ctx.getLastPrice() : 0;
        int mins = sessionWindow.minutesSinceRthOpen();
        OpenTransitionEngine.OpenTransition t = engine.openContext(pm.get(), mins, last);
        lastMarketTransition = t;
        if (sessionWindow.isOpenTransitionWindow() && mins <= 20) {
            telemetryService.recordAsync(pm.get(), t.state());
        }
        return t;
    }

    public int marketBearishFactor() {
        long bearish = cache.values().stream()
                .filter(s -> OpenTransitionEngine.isBearishPm(s.trendState())).count();
        if (cache.isEmpty()) return 0;
        return (int) Math.round(100.0 * bearish / cache.size());
    }

    /** Scanner ranking overlay (bullish/bearish boost labels). */
    public String scannerRankLabel(String symbol) {
        return get(symbol).map(s -> switch (s.trendState()) {
            case HEALTHY_CONTINUATION, EARLY_EXPANSION -> "PM CONTINUATION";
            case FAILED_GAP -> "FAILED GAP";
            case DISTRIBUTION -> "PM DISTRIBUTION";
            case RECLAIM_FAILURE, PM_BREAKDOWN -> "PM RECLAIM FAIL";
            default -> null;
        }).orElse(null);
    }

    public int scannerRankBoost(String symbol) {
        return get(symbol).map(s -> switch (s.trendState()) {
            case HEALTHY_CONTINUATION, EARLY_EXPANSION -> 8;
            case FAILED_GAP, RECLAIM_FAILURE, PM_BREAKDOWN, DISTRIBUTION -> -10;
            case PARABOLIC_EXTENSION -> -6;
            default -> 0;
        }).orElse(0);
    }
}
