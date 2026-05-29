package com.tradingbot.intelligence.live;

import com.tradingbot.replay.ReplayRuntimeMode;
import com.tradingbot.repository.TradingSymbolRepository;
import com.tradingbot.services.SymbolLoadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.PriorityBlockingQueue;

/**
 * Phase 187 — async historical hydration (research layer only).
 * Does not block live scanner.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BackgroundHydrationOrchestrator {

    public enum Priority {
        HIGH(0), MEDIUM(1), LOW(2);

        final int weight;

        Priority(int weight) {
            this.weight = weight;
        }
    }

    private record HydrationJob(String symbol, Priority priority, long enqueuedAt) implements Comparable<HydrationJob> {
        @Override
        public int compareTo(HydrationJob o) {
            int p = Integer.compare(this.priority.weight, o.priority.weight);
            if (p != 0) return p;
            return Long.compare(this.enqueuedAt, o.enqueuedAt);
        }
    }

    private final PriorityBlockingQueue<HydrationJob> queue = new PriorityBlockingQueue<>();
    private final Map<String, Long> lastQueuedMs = new ConcurrentHashMap<>();

    private final SymbolLoadService symbolLoadService;
    private final TradingSymbolRepository symbolRepository;
    private final BackgroundHydrationRuntimeState runtimeState;
    private final ReplayRuntimeMode replayRuntimeMode;

    private static final long DEDUPE_MS = 120_000;

    public HydrationControlsDto controlsSnapshot() {
        return new HydrationControlsDto(runtimeState.isEnabled(), queue.size());
    }

    public void setEnabled(boolean enabled) {
        runtimeState.setEnabled(enabled);
        if (!enabled) {
            queue.clear();
            log.info("Background hydration disabled — queue cleared");
        } else {
            log.info("Background hydration enabled");
        }
    }

    public boolean isEnabled() {
        return runtimeState.isEnabled();
    }

    public void queueHigh(String symbol) {
        enqueue(symbol, Priority.HIGH);
    }

    public void promoteHigh(String symbol) {
        enqueue(symbol, Priority.HIGH);
    }

    public void queueMedium(String symbol) {
        enqueue(symbol, Priority.MEDIUM);
    }

    public void queueLow(String symbol) {
        enqueue(symbol, Priority.LOW);
    }

    private void enqueue(String symbol, Priority priority) {
        if (!runtimeState.isEnabled()) {
            return;
        }
        String sym = symbol.toUpperCase(Locale.US);
        long now = System.currentTimeMillis();
        Long last = lastQueuedMs.get(sym);
        if (last != null && now - last < DEDUPE_MS && priority == Priority.LOW) {
            return;
        }
        lastQueuedMs.put(sym, now);
        queue.offer(new HydrationJob(sym, priority, now));
        if (priority == Priority.LOW) {
            log.trace("Research hydration queued {} priority={}", sym, priority);
        }
    }

    /** Drain one job every 8s — low priority background work. */
    @Scheduled(fixedDelay = 8000, initialDelay = 15000)
    public void processQueue() {
        if (replayRuntimeMode.isReplayActive()) {
            return;
        }
        HydrationJob job = queue.poll();
        if (job == null) {
            return;
        }
        if (!isEnabledSymbol(job.symbol())) {
            return;
        }
        if (symbolLoadService.hasHistoricalData(job.symbol())) {
            return;
        }
        log.info("Background hydration {} ({})", job.symbol(), job.priority);
        symbolLoadService.activateSymbol(job.symbol());
    }

    /** Nightly-ish sweep of enabled symbols missing candles (LOW). */
    @Scheduled(fixedDelay = 300_000, initialDelay = 120_000)
    public void sweepInactive() {
        if (replayRuntimeMode.isReplayActive() || !runtimeState.isEnabled()) {
            return;
        }
        for (var row : symbolRepository.findByActiveTrueAndEnabledTrueOrderByPinnedDescDisplayOrderAscSymbolAsc()) {
            String sym = row.getSymbol();
            if (!symbolLoadService.hasHistoricalData(sym)) {
                queueLow(sym);
            }
        }
    }

    private boolean isEnabledSymbol(String symbol) {
        return symbolRepository.findBySymbolIgnoreCase(symbol.toUpperCase(Locale.US))
                .filter(r -> r.isActive() && r.isEnabled())
                .isPresent();
    }
}
