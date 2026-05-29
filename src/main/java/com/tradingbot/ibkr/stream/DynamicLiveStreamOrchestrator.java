package com.tradingbot.ibkr.stream;

import com.tradingbot.config.IBKRProperties;
import com.tradingbot.dataintegrity.recovery.ReconnectRecoveryCoordinator;
import com.tradingbot.historical.CandleHistoryService;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.ibkr.SubscriptionManagerService;
import com.tradingbot.ibkr.connection.IbkrConnectionPhase;
import com.tradingbot.ibkr.connection.IbkrReadinessGate;
import com.tradingbot.ibkr.connection.StreamTickHealth;
import com.tradingbot.ibkr.connection.VerifiedStreamRegistry;
import com.tradingbot.ibkr.diagnostics.StreamPipelineDiagnostics;
import com.tradingbot.livetrader.LiveTraderDtos;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Phase 194/216 — dynamic IBKR realtime slot allocation (waits for IBKR_READY).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@EnableConfigurationProperties(LiveStreamProperties.class)
public class DynamicLiveStreamOrchestrator {

    private final LiveStreamProperties streamProperties;
    private final IBKRProperties ibkrProperties;
    private final StreamPriorityEngine priorityEngine;
    private final LiveStreamSlotManager slotManager;
    private final IBKRClientService ibkrClientService;
    private final SubscriptionManagerService subscriptionManager;
    private final CandleHistoryService candleHistoryService;
    private final IbkrReadinessGate readinessGate;
    private final VerifiedStreamRegistry verifiedStreams;
    private final StreamPipelineDiagnostics streamDiagnostics;
    private final ObjectProvider<ReconnectRecoveryCoordinator> reconnectRecoveryProvider;

    private volatile long lastReconcileMs;
    private volatile long lastSnapshotRefreshMs;

    public boolean isDynamicEnabled() {
        return streamProperties.isDynamicEnabled();
    }

    /** Phase 216 — first stream allocation after IBKR_READY (not at socket connect). */
    public void bootstrapAfterReady() {
        if (!isDynamicEnabled() || !ibkrClientService.isIbkrReady()) {
            return;
        }
        log.info("Dynamic live stream bootstrap after IBKR_READY (maxRealtime={})",
                ibkrProperties.getMaxLiveStreams());
        subscriptionManager.clearAll();
        slotManager.clear();
        reconcile();
        reconnectRecoveryProvider.ifAvailable(ReconnectRecoveryCoordinator::onBrokerReady);
    }

    /** Legacy entry — delegates when ready. */
    public void bootstrapLiveStreams() {
        bootstrapAfterReady();
    }

    public void reconcileWhenReady() {
        if (ibkrClientService.isIbkrReady()) {
            reconcile();
        }
    }

    @Scheduled(fixedDelayString = "${ibkr.stream.snapshot-interval-ms:30000}", initialDelay = 20_000)
    public void snapshotRefresh() {
        if (!isDynamicEnabled()) {
            return;
        }
        List<String> snapshot = slotManager.symbolsByTier(LiveStreamTier.SNAPSHOT);
        if (snapshot.isEmpty()) {
            return;
        }
        long now = System.currentTimeMillis();
        lastSnapshotRefreshMs = now;
        for (String sym : snapshot) {
            candleHistoryService.loadSessionCandles(sym);
        }
        log.trace("Snapshot tier refresh {} symbols", snapshot.size());
    }

    public synchronized void reconcile() {
        if (!isDynamicEnabled()) {
            return;
        }
        if (!ibkrClientService.isIbkrReady()) {
            log.trace("Skipping stream reconcile — IBKR not ready");
            return;
        }
        streamDiagnostics.recordReconcileStart();
        try {
            int maxRt = ibkrProperties.getMaxLiveStreams() > 0 ? ibkrProperties.getMaxLiveStreams() : 40;
            int maxSnap = streamProperties.getMaxSnapshotSymbols();
            List<SymbolStreamAllocation> desired = priorityEngine.computeAllocations(maxRt, maxSnap);
            slotManager.apply(desired);
            lastReconcileMs = System.currentTimeMillis();
            streamDiagnostics.recordReconcileEnd(
                    slotManager.promotionQueue().size(),
                    slotManager.demotionQueue().size());
        } catch (RuntimeException ex) {
            streamDiagnostics.setRootCauseHint("A_ORCHESTRATION");
            throw ex;
        }
    }

    /** After IBKR reconnect — priority restore, not blind full watchlist. */
    public int restoreAfterReconnect() {
        if (!ibkrClientService.isIbkrReady()) {
            return 0;
        }
        subscriptionManager.clearAll();
        slotManager.clear();
        if (!isDynamicEnabled()) {
            return 0;
        }
        int maxRt = ibkrProperties.getMaxLiveStreams() > 0 ? ibkrProperties.getMaxLiveStreams() : 40;
        List<SymbolStreamAllocation> desired = priorityEngine.computeAllocations(
                maxRt,
                streamProperties.getMaxSnapshotSymbols()
        );
        int restored = slotManager.restoreByPriority(desired);
        log.info("Dynamic stream reconnect restore: {} realtime slots", restored);
        return restored;
    }

    public void onSymbolTouched(String symbol) {
        if (!isDynamicEnabled()) {
            if (ibkrClientService.isIbkrReady()) {
                subscriptionManager.subscribeIfNeeded(symbol);
            }
            return;
        }
        reconcileWhenReady();
    }

    public LiveTraderDtos.StreamStateDto snapshot() {
        int max = ibkrProperties.getMaxLiveStreams() > 0 ? ibkrProperties.getMaxLiveStreams() : 0;
        int registryUsed = subscriptionManager.registrySubscriptionCount();
        int verifiedUsed = verifiedStreams.verifiedCount();

        List<LiveTraderDtos.StreamSymbolDto> realtime = new ArrayList<>();
        List<LiveTraderDtos.StreamSymbolDto> snapshot = new ArrayList<>();
        List<LiveTraderDtos.StreamSymbolDto> dormant = new ArrayList<>();

        for (SymbolStreamAllocation a : slotManager.allocations().values().stream()
                .sorted(Comparator.comparingInt(SymbolStreamAllocation::priorityScore).reversed())
                .toList()) {
            boolean tickVerified = verifiedStreams.verifiedSymbols().contains(a.symbol().toUpperCase(Locale.US));
            LiveTraderDtos.StreamSymbolDto row = new LiveTraderDtos.StreamSymbolDto(
                    a.symbol(),
                    a.tier().name(),
                    a.reason().name(),
                    a.priorityScore(),
                    a.dominanceScore(),
                    a.lifecycle(),
                    tickVerified,
                    verifiedStreams.healthFor(a.symbol()).name()
            );
            if (tickVerified || a.ibkrSubscribed()) {
                realtime.add(row);
            } else if (a.tier() == LiveStreamTier.SNAPSHOT) {
                snapshot.add(row);
            } else {
                dormant.add(row);
            }
        }

        long staleMs = streamProperties.getStaleSeconds() * 1000L;
        long deadMs = streamProperties.getDeadSeconds() * 1000L;

        return new LiveTraderDtos.StreamStateDto(
                streamProperties.isDynamicEnabled(),
                verifiedUsed,
                max,
                registryUsed,
                realtime,
                snapshot,
                dormant,
                slotManager.promotionQueue(),
                slotManager.demotionQueue(),
                lastReconcileMs,
                lastSnapshotRefreshMs,
                verifiedStreams.staleSymbols(staleMs, deadMs),
                verifiedStreams.deadSymbols(deadMs),
                verifiedStreams.reconnectAttempts(),
                verifiedStreams.avgTickLatencyMs(),
                verifiedStreams.lastSuccessfulTickMs(),
                verifiedStreams.streamHealthScore(),
                readinessGate.phase().name()
        );
    }

    public LiveStreamTier tierFor(String symbol) {
        if (symbol == null) {
            return LiveStreamTier.DORMANT;
        }
        SymbolStreamAllocation a = slotManager.allocations().get(symbol.toUpperCase(Locale.US));
        if (a == null) {
            return LiveStreamTier.DORMANT;
        }
        StreamTickHealth health = verifiedStreams.healthFor(symbol);
        if (health == StreamTickHealth.LIVE || health == StreamTickHealth.DEGRADED) {
            return LiveStreamTier.REALTIME;
        }
        if (a.ibkrSubscribed()) {
            return LiveStreamTier.REALTIME;
        }
        return a.tier();
    }
}
