package com.tradingbot.dataintegrity;

import com.tradingbot.dataintegrity.continuity.CandleContinuityValidator;
import com.tradingbot.dataintegrity.integrity.DataIntegrityScore;
import com.tradingbot.dataintegrity.integrity.IntegrityStateManager;
import com.tradingbot.dataintegrity.integrity.RuntimeIntegrityState;
import com.tradingbot.dataintegrity.staleness.StaleDataDetector;
import com.tradingbot.dataintegrity.telemetry.DataIntegrityTelemetryService;
import com.tradingbot.historical.CandleHistoryService;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.ibkr.connection.IbkrReadinessGate;
import com.tradingbot.ibkr.connection.VerifiedStreamRegistry;
import com.tradingbot.models.Candle;
import com.tradingbot.replay.ReplayRuntimeMode;
import com.tradingbot.services.TradingSymbolService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/** Phase 212 — orchestrates validators and integrity score. */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataIntegrityEngine {

    /** Phase 219 — avoid STALE while streams bootstrap after IBKR_READY. */
    private static final long STREAM_BOOTSTRAP_GRACE_MS = 90_000;

    private final IntegrityStateManager stateManager;
    private final StaleDataDetector staleDataDetector;
    private final CandleContinuityValidator continuityValidator;
    private final CandleHistoryService candleHistoryService;
    private final IBKRClientService ibkrClientService;
    private final ReplayRuntimeMode replayRuntimeMode;
    private final DataIntegrityTelemetryService telemetryService;
    private final TradingSymbolService tradingSymbolService;
    private final IbkrReadinessGate readinessGate;
    private final VerifiedStreamRegistry verifiedStreamRegistry;

    private final AtomicInteger validCandlesSinceRecovery = new AtomicInteger(0);

    public boolean isReplayOrBypass() {
        return replayRuntimeMode.isReplayActive();
    }

    public DataIntegritySnapshot current() {
        if (isReplayOrBypass()) {
            return liveBypassSnapshot();
        }
        return stateManager.lastSnapshot();
    }

    public static DataIntegritySnapshot liveBypassSnapshot() {
        return new DataIntegritySnapshot(
                RuntimeIntegrityState.LIVE, 100, true, false,
                1.0, 1.0, 1.0, 0, List.of(), System.currentTimeMillis());
    }

    public void onDisconnected() {
        if (isReplayOrBypass()) return;
        stateManager.markDisconnected();
        telemetryService.record("DISCONNECTED", "IBKR disconnected");
    }

    public void onRecoveryStarted(int stabilizationBars) {
        if (isReplayOrBypass()) return;
        stateManager.beginRecovery(stabilizationBars);
        validCandlesSinceRecovery.set(0);
        telemetryService.record("RECOVERING", "Stabilization requires " + stabilizationBars + " candles");
        telemetryService.record("EXECUTION_FROZEN", "Recovery mode — auto execution blocked");
        assessGlobal();
    }

    public void recordTick(String symbol, double price, long epochMs) {
        if (isReplayOrBypass()) return;
        staleDataDetector.recordTick(symbol, price, epochMs);
    }

    public void recordCandleClosed(String symbol) {
        if (isReplayOrBypass()) return;
        if (stateManager.globalState() == RuntimeIntegrityState.RECOVERING) {
            validCandlesSinceRecovery.incrementAndGet();
            if (stateManager.recordStabilizationCandle()) {
                telemetryService.record("LIVE_RESUMED", "Stabilization complete for " + symbol);
            }
        }
        assessSymbol(symbol);
    }

    public void assessGlobal() {
        if (isReplayOrBypass()) return;
        if (!ibkrClientService.isConnected()) {
            onDisconnected();
            return;
        }
        if (!readinessGate.isIbkrReady()) {
            publishBrokerNotReady();
            return;
        }
        if (verifiedStreamRegistry.verifiedCount() == 0) {
            publishNoVerifiedStreams();
            return;
        }
        StaleDataDetector.StaleResult stale = assessWorstStale();
        String probeSymbol = tradingSymbolService.getEnabledSymbolSet().stream().findFirst().orElse("SPY");
        List<Candle> session = candleHistoryService.recentSessionCandles(probeSymbol, 40);
        CandleContinuityValidator.ContinuityResult continuity =
                continuityValidator.validate(session, 5);

        RuntimeIntegrityState state = resolveState(stale, continuity);
        int score = DataIntegrityScore.compute(state, stale, continuity, stateManager.stabilizationRemaining());
        double domMult = confidenceMultiplier(state);
        DataIntegritySnapshot snap = new DataIntegritySnapshot(
                state,
                score,
                state.allowsExecution() && state != RuntimeIntegrityState.RECOVERING,
                state.freezeRegimeMutation(),
                domMult,
                domMult,
                domMult,
                stateManager.stabilizationRemaining(),
                mergeIssues(stale, continuity),
                System.currentTimeMillis());
        RuntimeIntegrityState prev = stateManager.globalState();
        stateManager.publishSnapshot(snap);
        if (prev != state) {
            if (state == RuntimeIntegrityState.DEGRADED) {
                telemetryService.record("DEGRADED", String.join("; ", snap.issues()));
            } else if (state == RuntimeIntegrityState.STALE) {
                telemetryService.record("STALE", String.join("; ", snap.issues()));
            } else if (state == RuntimeIntegrityState.RECOVERING) {
                telemetryService.record("RECOVERING", "Awaiting stabilization");
            }
        }
    }

    private StaleDataDetector.StaleResult assessWorstStale() {
        StaleDataDetector.StaleResult worst =
                new StaleDataDetector.StaleResult(RuntimeIntegrityState.LIVE, 95, List.of());
        for (String sym : tradingSymbolService.getEnabledSymbolSet().stream().limit(8).toList()) {
            Long tickMs = ibkrClientService.getLastTickEpochMs(sym);
            StaleDataDetector.StaleResult r = staleDataDetector.assess(sym, tickMs != null && tickMs > 0 ? tickMs : null);
            if (r.suggested().ordinal() > worst.suggested().ordinal()
                    || (r.suggested() == worst.suggested() && r.freshnessScore() < worst.freshnessScore())) {
                worst = r;
            }
        }
        return worst;
    }

    public void assessSymbol(String symbol) {
        if (isReplayOrBypass()) return;
        Long tickMs = ibkrClientService.getLastTickEpochMs(symbol);
        StaleDataDetector.StaleResult stale = staleDataDetector.assess(symbol, tickMs != null && tickMs > 0 ? tickMs : null);
        List<Candle> candles = candleHistoryService.recentSessionCandles(symbol, 30);
        CandleContinuityValidator.ContinuityResult continuity = continuityValidator.validate(candles, 5);
        RuntimeIntegrityState symState = resolveState(stale, continuity);
        stateManager.setSymbolState(symbol, symState);
        assessGlobal();
    }

    private void publishBrokerNotReady() {
        DataIntegritySnapshot snap = new DataIntegritySnapshot(
                RuntimeIntegrityState.DEGRADED, 40, false, true,
                0.5, 0.5, 0.5, stateManager.stabilizationRemaining(),
                List.of("IBKR handshake incomplete"), System.currentTimeMillis());
        stateManager.publishSnapshot(snap);
    }

    private void publishNoVerifiedStreams() {
        long readyAt = readinessGate.ibkrReadyAtMs();
        if (readyAt > 0 && System.currentTimeMillis() - readyAt < STREAM_BOOTSTRAP_GRACE_MS) {
            publishBootstrapWaiting();
            return;
        }
        DataIntegritySnapshot snap = new DataIntegritySnapshot(
                RuntimeIntegrityState.STALE, 25, false, true,
                0.5, 0.5, 0.5, stateManager.stabilizationRemaining(),
                List.of("No verified realtime ticks"), System.currentTimeMillis());
        stateManager.publishSnapshot(snap);
    }

    private void publishBootstrapWaiting() {
        DataIntegritySnapshot snap = new DataIntegritySnapshot(
                RuntimeIntegrityState.DEGRADED, 55, false, true,
                0.7, 0.7, 0.7, stateManager.stabilizationRemaining(),
                List.of("Stream bootstrap — awaiting verified ticks"),
                System.currentTimeMillis());
        stateManager.publishSnapshot(snap);
    }

    private RuntimeIntegrityState resolveState(
            StaleDataDetector.StaleResult stale,
            CandleContinuityValidator.ContinuityResult continuity
    ) {
        RuntimeIntegrityState base = stateManager.globalState();
        if (base == RuntimeIntegrityState.DISCONNECTED) {
            return RuntimeIntegrityState.DISCONNECTED;
        }
        if (base == RuntimeIntegrityState.RECOVERING) {
            return RuntimeIntegrityState.RECOVERING;
        }
        if (!readinessGate.isStreamHealthy() && verifiedStreamRegistry.verifiedCount() == 0) {
            long readyAt = readinessGate.ibkrReadyAtMs();
            if (readyAt > 0 && System.currentTimeMillis() - readyAt < STREAM_BOOTSTRAP_GRACE_MS) {
                return RuntimeIntegrityState.DEGRADED;
            }
            return RuntimeIntegrityState.STALE;
        }
        if (!continuity.acceptable()) {
            return RuntimeIntegrityState.DEGRADED;
        }
        return stale.suggested();
    }

    private static double confidenceMultiplier(RuntimeIntegrityState state) {
        return switch (state) {
            case LIVE -> 1.0;
            case DELAYED -> 0.9;
            case STALE, DEGRADED -> 0.75;
            case RECOVERING, DISCONNECTED -> 0.5;
        };
    }

    private static List<String> mergeIssues(
            StaleDataDetector.StaleResult stale,
            CandleContinuityValidator.ContinuityResult continuity
    ) {
        List<String> all = new ArrayList<>(stale.issues());
        all.addAll(continuity.issues());
        return all;
    }
}
