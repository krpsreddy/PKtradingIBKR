package com.tradingbot.ibkr.diagnostics;

import com.tradingbot.candle.CandleAggregatorService;
import com.tradingbot.dataintegrity.DataIntegrityEngine;
import com.tradingbot.dataintegrity.DataIntegritySnapshot;
import com.tradingbot.historical.CandleHistoryService;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.ibkr.SubscriptionManagerService;
import com.tradingbot.ibkr.connection.IbkrReadinessGate;
import com.tradingbot.ibkr.connection.VerifiedStreamRegistry;
import com.tradingbot.models.Candle;
import com.tradingbot.runtime.RuntimeProfileDto;
import com.tradingbot.runtime.RuntimeProfileService;
import com.tradingbot.services.TradingSymbolService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StreamDiagnosticsService {

    private final StreamPipelineDiagnostics diagnostics;
    private final IBKRClientService ibkrClientService;
    private final SubscriptionManagerService subscriptionManager;
    private final VerifiedStreamRegistry verifiedStreamRegistry;
    private final IbkrReadinessGate readinessGate;
    private final DataIntegrityEngine dataIntegrityEngine;
    private final CandleHistoryService candleHistoryService;
    private final CandleAggregatorService candleAggregatorService;
    private final TradingSymbolService tradingSymbolService;
    private final RuntimeProfileService runtimeProfileService;

    public StreamPipelineDiagnostics.StreamHealthSnapshot streamDebug() {
        RuntimeProfileDto runtime = runtimeProfileService.snapshot();
        return diagnostics.snapshot(
                ibkrClientService.isConnected(),
                ibkrClientService.isIbkrReady(),
                ibkrClientService.isLiveStreaming(),
                subscriptionManager.registrySubscriptionCount(),
                verifiedStreamRegistry.verifiedCount(),
                ibkrClientService.activeMarketDataLineCount(),
                readinessGate.ibkrReadyAtMs(),
                subscriptionManager.exportSubscribedSymbols(),
                runtime.runtime(),
                runtime.integrityMode()
        );
    }

    public TickHealthDto tickHealth() {
        long now = System.currentTimeMillis();
        List<SymbolTickRow> rows = new ArrayList<>();
        for (String sym : tradingSymbolService.getEnabledSymbolSet().stream().limit(24).toList()) {
            Long tickMs = ibkrClientService.getLastTickEpochMs(sym);
            long age = tickMs != null && tickMs > 0 ? now - tickMs : -1;
            rows.add(new SymbolTickRow(
                    sym,
                    tickMs != null ? tickMs : 0,
                    age,
                    ibkrClientService.getLastPrice(sym),
                    verifiedStreamRegistry.healthFor(sym).name(),
                    subscriptionManager.isSubscribed(sym)
            ));
        }
        rows.sort((a, b) -> Long.compare(a.lastTickAgeMs(), b.lastTickAgeMs()));
        RuntimeProfileDto runtime = runtimeProfileService.snapshot();
        return new TickHealthDto(
                diagnostics.snapshot(
                        ibkrClientService.isConnected(),
                        ibkrClientService.isIbkrReady(),
                        ibkrClientService.isLiveStreaming(),
                        subscriptionManager.registrySubscriptionCount(),
                        verifiedStreamRegistry.verifiedCount(),
                        ibkrClientService.activeMarketDataLineCount(),
                        readinessGate.ibkrReadyAtMs(),
                        subscriptionManager.exportSubscribedSymbols(),
                        runtime.runtime(),
                        runtime.integrityMode()
                ),
                rows
        );
    }

    public CandleHealthDto candleHealth() {
        String probe = tradingSymbolService.getEnabledSymbolSet().stream().findFirst().orElse("SPY");
        List<Candle> recent = candleHistoryService.recentSessionCandles(probe, 12);
        Candle latest = recent.isEmpty() ? null : recent.get(recent.size() - 1);
        LocalDateTime latestOpen = latest != null ? latest.getOpenTime() : null;
        long lagMs = latestOpen != null
                ? java.time.Duration.between(latestOpen, com.tradingbot.services.MarketTime.nowLocal()).toMillis()
                : -1;
        var live = candleAggregatorService.getLiveSnapshot(probe);
        DataIntegritySnapshot integrity = dataIntegrityEngine.current();
        RuntimeProfileDto runtime = runtimeProfileService.snapshot();
        return new CandleHealthDto(
                probe,
                latestOpen != null ? latestOpen.toString() : null,
                lagMs,
                live.isPresent(),
                live.map(l -> l.close() != null ? l.close().doubleValue() : null).orElse(null),
                integrity.state().name(),
                integrity.score(),
                runtime.runtime(),
                runtime.integrityMode(),
                diagnostics.candleGapTrace()
        );
    }

    public ReconnectHistoryDto reconnectHistory() {
        return new ReconnectHistoryDto(
                diagnostics.reconnectCount(),
                diagnostics.reconnectTrace(),
                diagnostics.lifecycleTrace()
        );
    }

    public record SymbolTickRow(
            String symbol,
            long lastTickMs,
            long lastTickAgeMs,
            Double lastPrice,
            String tickHealth,
            boolean registrySubscribed
    ) {}

    public record TickHealthDto(
            StreamPipelineDiagnostics.StreamHealthSnapshot summary,
            List<SymbolTickRow> symbols
    ) {}

    public record CandleHealthDto(
            String probeSymbol,
            String latestPersistedBarOpen,
            long candleBuildLagMs,
            boolean livePartialCandle,
            Double livePartialClose,
            String integrityState,
            int integrityScore,
            String runtime,
            String integrityMode,
            List<StreamPipelineDiagnostics.StreamTraceEvent> gapTrace
    ) {}

    public record ReconnectHistoryDto(
            int reconnectCount,
            List<StreamPipelineDiagnostics.StreamTraceEvent> reconnectTrace,
            List<StreamPipelineDiagnostics.StreamTraceEvent> lifecycleTrace
    ) {}
}
