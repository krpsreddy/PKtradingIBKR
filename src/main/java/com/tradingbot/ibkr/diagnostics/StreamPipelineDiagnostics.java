package com.tradingbot.ibkr.diagnostics;

import com.tradingbot.ibkr.connection.IbkrConnectionPhase;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Phase 219 — live stream pipeline tracing (instrumentation only).
 */
@Slf4j
@Component
public class StreamPipelineDiagnostics {

    private static final int MAX_TRACE = 200;

    private final Deque<StreamTraceEvent> lifecycleTrace = new ArrayDeque<>();
    private final Deque<StreamTraceEvent> subscriptionTrace = new ArrayDeque<>();
    private final Deque<StreamTraceEvent> tickTrace = new ArrayDeque<>();
    private final Deque<StreamTraceEvent> reconnectTrace = new ArrayDeque<>();
    private final Deque<StreamTraceEvent> candleGapTrace = new ArrayDeque<>();

    private final AtomicLong ticksTotal = new AtomicLong();
    private final AtomicLong ticksWindowStartMs = new AtomicLong(System.currentTimeMillis());
    private final AtomicInteger ticksInWindow = new AtomicInteger();
    private final AtomicInteger subscribeAttempts = new AtomicInteger();
    private final AtomicInteger subscribeSuccess = new AtomicInteger();
    private final AtomicInteger subscribeFailed = new AtomicInteger();
    private final AtomicInteger unsubscribeCount = new AtomicInteger();
    private final AtomicInteger reconnectCount = new AtomicInteger();
    private final AtomicInteger pacingViolationCount = new AtomicInteger();
    private final AtomicLong lastTickAtMs = new AtomicLong();
    private final AtomicLong lastReconcileStartMs = new AtomicLong();
    private final AtomicLong lastReconcileDurationMs = new AtomicLong();
    private final Map<String, Long> lastTickBySymbol = new ConcurrentHashMap<>();

    private final AtomicInteger marketDataEntitlementErrors = new AtomicInteger();

    private volatile IbkrConnectionPhase lastPhase = IbkrConnectionPhase.DISCONNECTED;
    private volatile String rootCauseHint = "UNKNOWN";

    public void recordLifecycle(String event, String detail) {
        push(lifecycleTrace, "LIFECYCLE", event, detail);
        log.debug("stream_lifecycle: {} — {}", event, detail);
    }

    public void recordPhase(IbkrConnectionPhase phase) {
        lastPhase = phase;
        recordLifecycle("PHASE", phase.name());
    }

    public void recordSubscriptionAttempt(String symbol, boolean success, String reason) {
        subscribeAttempts.incrementAndGet();
        if (success) {
            subscribeSuccess.incrementAndGet();
        } else {
            subscribeFailed.incrementAndGet();
            if (reason != null && (reason.contains("not ready") || reason.contains("not connected"))) {
                rootCauseHint = "C_SUBSCRIPTION_TIMING";
            }
        }
        push(subscriptionTrace, "SUBSCRIBE", symbol, success ? "OK" : reason);
    }

    public void recordUnsubscribe(String symbol, String reason) {
        unsubscribeCount.incrementAndGet();
        if (symbol != null) {
            lastTickBySymbol.remove(symbol.toUpperCase(Locale.US));
        }
        push(subscriptionTrace, "UNSUBSCRIBE", symbol, reason);
    }

    public void recordTick(String symbol, double price) {
        long now = System.currentTimeMillis();
        ticksTotal.incrementAndGet();
        lastTickAtMs.set(now);
        lastTickBySymbol.put(symbol.toUpperCase(Locale.US), now);
        rollTickWindow(now);
        if (ticksTotal.get() % 500 == 0) {
            push(tickTrace, "TICK", symbol, "price=" + price);
        }
    }

    public void recordReconnect(String event, String detail) {
        reconnectCount.incrementAndGet();
        push(reconnectTrace, "RECONNECT", event, detail);
        recordLifecycle(event, detail);
    }

    public void recordCandleGap(String symbol, String detail) {
        push(candleGapTrace, "CANDLE", symbol, detail);
    }

    public void recordReconcileStart() {
        lastReconcileStartMs.set(System.currentTimeMillis());
        push(lifecycleTrace, "RECONCILE", "START", "");
    }

    public void recordReconcileEnd(int promoted, int demoted) {
        long dur = System.currentTimeMillis() - lastReconcileStartMs.get();
        lastReconcileDurationMs.set(dur);
        push(lifecycleTrace, "RECONCILE", "END", "ms=" + dur + " promoted=" + promoted + " demoted=" + demoted);
        if (dur > 5_000) {
            pacingViolationCount.incrementAndGet();
            rootCauseHint = "D_IBKR_PACING_OR_CHURN";
        }
    }

    public void setRootCauseHint(String hint) {
        if (hint != null) {
            rootCauseHint = hint;
        }
    }

    public void recordMarketDataEntitlementError() {
        marketDataEntitlementErrors.incrementAndGet();
        rootCauseHint = "H_MARKET_DATA_ENTITLEMENT";
    }

    public int marketDataEntitlementErrors() {
        return marketDataEntitlementErrors.get();
    }

    public int reconnectCount() {
        return reconnectCount.get();
    }

    public StreamHealthSnapshot snapshot(
            boolean connected,
            boolean ibkrReady,
            boolean streaming,
            int registrySubs,
            int verifiedStreams,
            int activeMktDataLines,
            long ibkrReadyAtMs,
            Set<String> activeSubscribedSymbols,
            String runtimeLabel,
            String integrityModeLabel
    ) {
        expireTickWindowIfNeeded(System.currentTimeMillis());
        long now = System.currentTimeMillis();
        List<String> stalled = lastTickBySymbol.entrySet().stream()
                .filter(e -> activeSubscribedSymbols == null
                        || activeSubscribedSymbols.isEmpty()
                        || activeSubscribedSymbols.contains(e.getKey()))
                .filter(e -> now - e.getValue() > 60_000)
                .map(Map.Entry::getKey)
                .sorted()
                .limit(20)
                .toList();

        long bootstrapGraceRemaining = 0;
        if (ibkrReady && verifiedStreams == 0 && ibkrReadyAtMs > 0) {
            long graceEnd = ibkrReadyAtMs + 90_000;
            bootstrapGraceRemaining = Math.max(0, graceEnd - now);
        }

        return new StreamHealthSnapshot(
                connected,
                ibkrReady,
                streaming,
                registrySubs,
                verifiedStreams,
                activeMktDataLines,
                ticksInWindow.get(),
                ticksTotal.get(),
                subscribeAttempts.get(),
                subscribeSuccess.get(),
                subscribeFailed.get(),
                unsubscribeCount.get(),
                reconnectCount.get(),
                pacingViolationCount.get(),
                lastTickAtMs.get(),
                lastReconcileDurationMs.get(),
                stalled.size(),
                stalled,
                lastPhase.name(),
                rootCauseHint,
                bootstrapGraceRemaining,
                marketDataEntitlementErrors.get(),
                runtimeLabel,
                integrityModeLabel,
                System.currentTimeMillis()
        );
    }

    public List<StreamTraceEvent> lifecycleTrace() {
        return List.copyOf(lifecycleTrace);
    }

    public List<StreamTraceEvent> subscriptionTrace() {
        return List.copyOf(subscriptionTrace);
    }

    public List<StreamTraceEvent> tickTrace() {
        return List.copyOf(tickTrace);
    }

    public List<StreamTraceEvent> reconnectTrace() {
        return List.copyOf(reconnectTrace);
    }

    public List<StreamTraceEvent> candleGapTrace() {
        return List.copyOf(candleGapTrace);
    }

    private void rollTickWindow(long now) {
        expireTickWindowIfNeeded(now);
        ticksInWindow.incrementAndGet();
    }

    /** Snapshot polling must not inflate tick counters. */
    private void expireTickWindowIfNeeded(long now) {
        long start = ticksWindowStartMs.get();
        if (now - start > 10_000) {
            ticksWindowStartMs.set(now);
            ticksInWindow.set(0);
        }
    }

    private void push(Deque<StreamTraceEvent> deque, String category, String subject, String detail) {
        synchronized (deque) {
            deque.addLast(new StreamTraceEvent(System.currentTimeMillis(), category, subject, detail));
            while (deque.size() > MAX_TRACE) {
                deque.removeFirst();
            }
        }
    }

    public record StreamTraceEvent(long atMs, String category, String subject, String detail) {}

    public record StreamHealthSnapshot(
            boolean ibkrConnected,
            boolean ibkrReady,
            boolean ibkrStreaming,
            int symbolsSubscribed,
            int symbolsStreaming,
            int activeMktDataLines,
            int ticksLast10s,
            long ticksTotal,
            int subscribeAttempts,
            int subscribeSuccess,
            int subscribeFailed,
            int unsubscribeCount,
            int reconnectCount,
            int pacingViolationCount,
            long lastSuccessfulTickMs,
            long lastReconcileDurationMs,
            int stalledSymbolCount,
            List<String> stalledSymbols,
            String ibkrPhase,
            String rootCauseHint,
            long streamBootstrapGraceRemainingMs,
            int marketDataEntitlementErrors,
            String runtime,
            String integrityMode,
            long assessedAtMs
    ) {}
}
