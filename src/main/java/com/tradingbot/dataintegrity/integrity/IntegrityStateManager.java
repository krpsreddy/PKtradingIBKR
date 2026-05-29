package com.tradingbot.dataintegrity.integrity;

import com.tradingbot.dataintegrity.DataIntegritySnapshot;
import com.tradingbot.services.MarketTime;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/** Phase 212 — global + per-symbol integrity runtime state. */
@Component
public class IntegrityStateManager {

    private final AtomicReference<RuntimeIntegrityState> globalState =
            new AtomicReference<>(RuntimeIntegrityState.DISCONNECTED);
    private final AtomicInteger stabilizationRemaining = new AtomicInteger(0);
    private final AtomicReference<DataIntegritySnapshot> lastSnapshot = new AtomicReference<>(
            DataIntegritySnapshot.disconnected());
    private final Map<String, RuntimeIntegrityState> symbolStates = new ConcurrentHashMap<>();
    private volatile Instant disconnectedAt;
    private volatile LocalDate disconnectSessionDay;

    public RuntimeIntegrityState globalState() {
        return globalState.get();
    }

    public void setSymbolState(String symbol, RuntimeIntegrityState state) {
        if (symbol != null) {
            symbolStates.put(symbol.toUpperCase(), state);
        }
    }

    public RuntimeIntegrityState symbolState(String symbol) {
        return symbolStates.getOrDefault(symbol.toUpperCase(), globalState.get());
    }

    public void publishSnapshot(DataIntegritySnapshot snapshot) {
        lastSnapshot.set(snapshot);
        globalState.set(snapshot.state());
    }

    public DataIntegritySnapshot lastSnapshot() {
        return lastSnapshot.get();
    }

    public void beginRecovery(int stabilizationBars) {
        globalState.set(RuntimeIntegrityState.RECOVERING);
        stabilizationRemaining.set(Math.max(0, stabilizationBars));
    }

    public void markDisconnected() {
        globalState.set(RuntimeIntegrityState.DISCONNECTED);
        stabilizationRemaining.set(0);
        disconnectedAt = Instant.now();
        disconnectSessionDay = MarketTime.now().toLocalDate();
        lastSnapshot.set(DataIntegritySnapshot.disconnected());
    }

    public boolean recordStabilizationCandle() {
        if (globalState.get() != RuntimeIntegrityState.RECOVERING) {
            return false;
        }
        int left = stabilizationRemaining.decrementAndGet();
        if (left <= 0) {
            globalState.set(RuntimeIntegrityState.LIVE);
            disconnectedAt = null;
            return true;
        }
        return false;
    }

    public int stabilizationRemaining() {
        return Math.max(0, stabilizationRemaining.get());
    }

    public long disconnectMinutes() {
        if (disconnectedAt == null) {
            return 0;
        }
        return java.time.Duration.between(disconnectedAt, Instant.now()).toMinutes();
    }

    public boolean isNewSessionSinceDisconnect() {
        if (disconnectSessionDay == null) {
            return false;
        }
        return !disconnectSessionDay.equals(MarketTime.now().toLocalDate());
    }
}
