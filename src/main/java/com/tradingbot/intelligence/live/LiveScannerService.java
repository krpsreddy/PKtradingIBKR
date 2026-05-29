package com.tradingbot.intelligence.live;

import com.tradingbot.intelligence.snapshot.dto.IntelligenceSnapshotDtos.ScannerOpportunityDto;
import com.tradingbot.intelligence.snapshot.dto.IntelligenceSnapshotDtos.ScannerSnapshotDto;
import com.tradingbot.intelligence.live.runtime.RuntimeBootstrapService;
import com.tradingbot.bearish.BearishOperationalService;
import com.tradingbot.dataintegrity.ExecutionSafetyIntegrator;
import com.tradingbot.marketstructure.MarketStructureEngine;
import com.tradingbot.replay.ReplayRuntimeMode;
import com.tradingbot.sessionintelligence.PremarketIntelligenceService;
import com.tradingbot.sessionintelligence.session.PremarketSessionWindow;
import com.tradingbot.services.TradingSymbolService;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/**
 * Phase 187 — real-time autonomous scanner (in-memory, IBKR-driven).
 * Decoupled from historical analytics hydration.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LiveScannerService {

    private static final int TOP_N = 40;

    private final TradingSymbolService tradingSymbolService;
    private final SymbolContextRegistry symbolContextRegistry;
    private final RealtimeRegimeEngine regimeEngine;
    private final LiveScannerRollingCache rollingCache;
    private final MarketSessionClock sessionClock;
    private final RuntimeBootstrapService runtimeBootstrap;
    private final ReplayRuntimeMode replayRuntimeMode;
    private final MarketStructureEngine marketStructureEngine;
    private final ExecutionSafetyIntegrator executionSafetyIntegrator;
    private final BearishOperationalService bearishOperationalService;
    private final PremarketIntelligenceService premarketIntelligenceService;
    private final PremarketSessionWindow premarketSessionWindow;

    private volatile ScannerSnapshotDto cachedSnapshot = emptySnapshot();
    private final AtomicInteger generation = new AtomicInteger(0);

    public ScannerSnapshotDto currentSnapshot() {
        ensureFresh();
        return cachedSnapshot;
    }

    /** Refresh if empty or older than maxAgeMs (mobile/tier1 must not read stale cache). */
    public void ensureFresh(long maxAgeMs) {
        if (replayRuntimeMode.isReplayActive()) {
            return;
        }
        if (cachedSnapshot.opportunities().isEmpty()
                || System.currentTimeMillis() - cachedSnapshot.generatedAt() > maxAgeMs) {
            refresh();
        }
    }

    public void ensureFresh() {
        ensureFresh(3_000);
    }

    public int generation() {
        return generation.get();
    }

    /** Full watchlist scan tick — no DB reads. */
    public void refresh() {
        if (replayRuntimeMode.isReplayActive()) {
            return;
        }
        marketStructureEngine.assess();
        rollingCache.ensureSession();
        Set<String> symbols = tradingSymbolService.getEnabledSymbolSet();
        if (symbols.isEmpty()) {
            cachedSnapshot = emptySnapshot();
            return;
        }

        String sessionKey = sessionClock.sessionDayKey();
        String window = sessionClock.windowLabel(sessionClock.sessionMinutesSinceRthOpen());
        List<ScannerOpportunityDto> opportunities = new ArrayList<>();

        boolean pmWindow = premarketSessionWindow.isActivePremarketIntelligenceWindow()
                || premarketSessionWindow.isOpenTransitionWindow();
        for (String sym : symbols) {
            if (pmWindow && premarketIntelligenceService.enabled()) {
                premarketIntelligenceService.refreshSymbol(sym);
            }
            SymbolContext ctx = symbolContextRegistry.getOrCreate(sym);
            RealtimeRegimeEngine.LiveRegimeEvaluation eval = regimeEngine.evaluate(ctx);
            String rvolLabel = regimeEngine.rvolLabel(ctx, eval.context());
            ScannerOpportunityDto dto = LiveScannerOpportunityMapper.toOpportunity(
                    sym, eval, window, rvolLabel);

            double rvol = eval.context().rvol() != null ? eval.context().rvol() : 0;
            LiveSymbolScanState state = rollingCache.stateFor(sym);
            if (!executionSafetyIntegrator.freezeRegimeMutation()) {
                int conviction = (int) Math.round(dto.convictionScore() * executionSafetyIntegrator.convictionMultiplier());
                state.update(sessionKey, conviction, dto.expansionProbability(),
                        (int) Math.round(dto.continuationPersistence() * executionSafetyIntegrator.persistenceMultiplier()),
                        rvol);
            }

            opportunities.add(bearishOperationalService.enrichScanner(dto));
        }

        double domMult = executionSafetyIntegrator.dominanceMultiplier();
        opportunities.sort(Comparator
                .comparingInt((ScannerOpportunityDto o) -> (int) Math.round(
                        rollingCache.stateFor(o.symbol()).dominanceScore() * domMult)
                        + premarketIntelligenceService.scannerRankBoost(o.symbol()))
                .reversed()
                .thenComparingInt(ScannerOpportunityDto::convictionScore).reversed());

        for (ScannerOpportunityDto o : opportunities.stream().limit(8).toList()) {
            rollingCache.stateFor(o.symbol()).recordTopRank();
        }

        List<ScannerOpportunityDto> ranked = opportunities.stream().limit(TOP_N).collect(Collectors.toList());
        cachedSnapshot = new ScannerSnapshotDto(
                true,
                System.currentTimeMillis(),
                new ArrayList<>(symbols),
                ranked,
                List.of(
                        ranked.size() + " live opportunities · " + symbols.size() + " symbols scanned",
                        "RealtimeRegimeEngine · session " + sessionKey,
                        "Streaming execution · rolling realtime state only"
                )
        );
        generation.incrementAndGet();
    }

    public ScannerSnapshotDto scan(List<String> requestedSymbols) {
        if (requestedSymbols == null || requestedSymbols.isEmpty()) {
            return currentSnapshot();
        }
        LinkedHashSet<String> wanted = requestedSymbols.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(s -> s.toUpperCase(Locale.US))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<ScannerOpportunityDto> filtered = cachedSnapshot.opportunities().stream()
                .filter(o -> wanted.contains(o.symbol()))
                .toList();

        if (filtered.size() == wanted.size()) {
            return new ScannerSnapshotDto(
                    true,
                    cachedSnapshot.generatedAt(),
                    new ArrayList<>(wanted),
                    filtered,
                    cachedSnapshot.summaryInsights()
            );
        }

        refresh();
        filtered = cachedSnapshot.opportunities().stream()
                .filter(o -> wanted.contains(o.symbol()))
                .toList();
        return new ScannerSnapshotDto(
                true,
                cachedSnapshot.generatedAt(),
                new ArrayList<>(wanted),
                filtered,
                cachedSnapshot.summaryInsights()
        );
    }

    public void onSymbolActivated(String symbol) {
        if (replayRuntimeMode.isReplayActive()) {
            symbolContextRegistry.getOrCreate(symbol);
            return;
        }
        symbolContextRegistry.getOrCreate(symbol);
        runtimeBootstrap.ensureBootstrapped(symbol);
        refresh();
    }

    private static ScannerSnapshotDto emptySnapshot() {
        return new ScannerSnapshotDto(true, System.currentTimeMillis(), List.of(), List.of(),
                List.of("No enabled symbols — add watchlist entries"));
    }
}
