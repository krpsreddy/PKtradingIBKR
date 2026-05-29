package com.tradingbot.dataintegrity.recovery;

import com.tradingbot.dataintegrity.continuity.CandleContinuityValidator;
import com.tradingbot.dataintegrity.integrity.IntegrityStateManager;
import com.tradingbot.dataintegrity.rebuild.RollingStateRebuildEngine;
import com.tradingbot.dataintegrity.telemetry.DataIntegrityTelemetryService;
import com.tradingbot.historical.CandleHistoryService;
import com.tradingbot.models.Candle;
import com.tradingbot.replay.ReplayRuntimeMode;
import com.tradingbot.services.TradingSymbolService;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/** Phase 212 — async IBKR backfill + rolling state rebuild. */
@Slf4j
@Service
@RequiredArgsConstructor
public class GapRecoveryService {

    private final CandleHistoryService candleHistoryService;
    private final CandleContinuityValidator continuityValidator;
    private final SymbolContextRegistry symbolContextRegistry;
    private final TradingSymbolService tradingSymbolService;
    private final ReplayRuntimeMode replayRuntimeMode;
    private final DataIntegrityTelemetryService telemetryService;
    private final RollingStateRebuildEngine stateRebuildEngine;
    private final HistoricalGapBackfillService historicalBackfill;
    private final RecoveryDowntimePolicy downtimePolicy;
    private final IntegrityStateManager stateManager;

    private final AtomicBoolean recoveryInProgress = new AtomicBoolean(false);

    @Value("${live.integrity.recovery-stabilization-candles:2}")
    private int stabilizationCandles;

    public boolean recoveryInProgress() {
        return recoveryInProgress.get();
    }

    @Async("dataIntegrityExecutor")
    public void backfillAndRebuild(Runnable onComplete) {
        if (replayRuntimeMode.isReplayActive()) {
            if (onComplete != null) onComplete.run();
            return;
        }
        if (!recoveryInProgress.compareAndSet(false, true)) {
            return;
        }
        long started = System.currentTimeMillis();
        try {
            RecoveryDowntimePolicy.Strategy strategy = downtimePolicy.resolve(
                    stateManager.disconnectMinutes(), stateManager.isNewSessionSinceDisconnect());
            int durationMin = downtimePolicy.historicalDurationMinutes(strategy);
            Set<String> symbols = tradingSymbolService.getEnabledSymbolSet();
            log.info("Gap recovery [{}]: {} symbols, {}m historical window",
                    strategy, symbols.size(), durationMin);

            telemetryService.record("RECOVERY_STARTED", strategy + " · " + symbols.size() + " symbols");

            if (strategy != RecoveryDowntimePolicy.Strategy.FRESH_SESSION_BOOTSTRAP) {
                historicalBackfill.backfillSymbols(symbols, durationMin);
            }

            for (String sym : symbols) {
                rebuildSymbol(sym, downtimePolicy.resetLifecycleState(strategy));
            }
            telemetryService.record("GAP_RECOVERY_COMPLETE",
                    strategy + " · " + (System.currentTimeMillis() - started) + "ms");
        } catch (Exception ex) {
            log.warn("Gap recovery failed: {}", ex.getMessage());
            telemetryService.record("GAP_RECOVERY_FAILED", ex.getMessage());
        } finally {
            recoveryInProgress.set(false);
            if (onComplete != null) {
                onComplete.run();
            }
        }
    }

    private void rebuildSymbol(String symbol, boolean resetLifecycle) {
        List<Candle> candles = candleHistoryService.recentSessionCandles(symbol, 120);
        CandleContinuityValidator.ContinuityResult continuity = continuityValidator.validate(candles, 5);
        var ctx = symbolContextRegistry.getOrCreate(symbol);
        if (resetLifecycle) {
            stateRebuildEngine.resetLifecycle(symbol);
        }
        stateRebuildEngine.rebuildSymbol(symbol, ctx, candles, continuity.continuityScore());
        telemetryService.record("SYMBOL_REBUILT", symbol + " candles=" + candles.size());
    }

    public int stabilizationCandlesRequired() {
        return stabilizationCandles;
    }
}
