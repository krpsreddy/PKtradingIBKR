package com.tradingbot.ibkr.connection;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Phase 216 — IBKR_READY only after socket + nextValidId + managedAccounts + market-data farm.
 */
@Slf4j
@Component
public class IbkrReadinessGate {

    private static final long MANAGED_ACCOUNTS_GRACE_MS = 8_000;

    private final AtomicBoolean socketConnected = new AtomicBoolean(false);
    private final AtomicBoolean nextValidIdReceived = new AtomicBoolean(false);
    private final AtomicBoolean managedAccountsReceived = new AtomicBoolean(false);
    private final AtomicBoolean marketDataFarmHealthy = new AtomicBoolean(false);
    private final AtomicBoolean ibkrReady = new AtomicBoolean(false);
    private final AtomicBoolean streamHealthy = new AtomicBoolean(false);
    private final AtomicReference<IbkrConnectionPhase> phase =
            new AtomicReference<>(IbkrConnectionPhase.DISCONNECTED);

    private volatile long socketConnectedAtMs;
    private volatile long ibkrReadyAtMs;
    private final List<Runnable> onIbkrReadyListeners = new CopyOnWriteArrayList<>();
    private final List<Runnable> onStreamHealthyListeners = new CopyOnWriteArrayList<>();

    public IbkrConnectionPhase phase() {
        return phase.get();
    }

    public boolean isSocketConnected() {
        return socketConnected.get();
    }

    public boolean isIbkrReady() {
        return ibkrReady.get();
    }

    public boolean isStreamHealthy() {
        return streamHealthy.get();
    }

    public long ibkrReadyAtMs() {
        return ibkrReadyAtMs;
    }

    public void onSocketConnected() {
        reset();
        socketConnected.set(true);
        socketConnectedAtMs = System.currentTimeMillis();
        phase.set(IbkrConnectionPhase.SOCKET_CONNECTED);
        log.info("IBKR phase SOCKET_CONNECTED");
    }

    public void onNextValidId() {
        nextValidIdReceived.set(true);
        phase.set(IbkrConnectionPhase.API_READY);
        tryPromoteIbkrReady();
    }

    public void onManagedAccounts() {
        managedAccountsReceived.set(true);
        tryPromoteIbkrReady();
    }

    public void onMarketDataFarmHealthy() {
        marketDataFarmHealthy.set(true);
        tryPromoteIbkrReady();
    }

    public void onStreamHealthy() {
        if (streamHealthy.compareAndSet(false, true)) {
            phase.set(IbkrConnectionPhase.DATA_HEALTHY);
            log.info("IBKR phase DATA_HEALTHY");
            for (Runnable r : onStreamHealthyListeners) {
                try {
                    r.run();
                } catch (Exception ex) {
                    log.warn("Stream healthy listener failed: {}", ex.getMessage());
                }
            }
        } else {
            phase.set(IbkrConnectionPhase.DATA_HEALTHY);
        }
    }

    public void onStreamInactive() {
        streamHealthy.set(false);
        if (ibkrReady.get()) {
            phase.set(IbkrConnectionPhase.STREAM_ACTIVE);
        }
    }

    private void tryPromoteIbkrReady() {
        if (ibkrReady.get()) {
            return;
        }
        if (!socketConnected.get() || !nextValidIdReceived.get() || !marketDataFarmHealthy.get()) {
            return;
        }
        long elapsed = System.currentTimeMillis() - socketConnectedAtMs;
        if (!managedAccountsReceived.get() && elapsed < MANAGED_ACCOUNTS_GRACE_MS) {
            return;
        }
        if (ibkrReady.compareAndSet(false, true)) {
            ibkrReadyAtMs = System.currentTimeMillis();
            phase.set(IbkrConnectionPhase.IBKR_READY);
            log.info("IBKR phase IBKR_READY (managedAccounts={})", managedAccountsReceived.get());
            for (Runnable r : onIbkrReadyListeners) {
                try {
                    r.run();
                } catch (Exception ex) {
                    log.warn("IBKR ready listener failed: {}", ex.getMessage());
                }
            }
        }
    }

    public void onIbkrReady(Runnable listener) {
        onIbkrReadyListeners.add(listener);
        if (ibkrReady.get()) {
            listener.run();
        }
    }

    public void onStreamHealthy(Runnable listener) {
        onStreamHealthyListeners.add(listener);
        if (streamHealthy.get()) {
            listener.run();
        }
    }

    public void reset() {
        socketConnected.set(false);
        nextValidIdReceived.set(false);
        managedAccountsReceived.set(false);
        marketDataFarmHealthy.set(false);
        ibkrReady.set(false);
        streamHealthy.set(false);
        phase.set(IbkrConnectionPhase.DISCONNECTED);
        socketConnectedAtMs = 0;
        ibkrReadyAtMs = 0;
    }

    public void markStreamActive() {
        if (!ibkrReady.get()) {
            return;
        }
        phase.set(IbkrConnectionPhase.STREAM_ACTIVE);
    }
}
