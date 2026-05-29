package com.tradingbot.dataintegrity.recovery;

import com.tradingbot.ibkr.HistoricalDataService;
import com.tradingbot.ibkr.IBKRClientService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/** Phase 212 — small rolling IBKR historical recovery (30–60m, not full-day reload). */
@Slf4j
@Service
@RequiredArgsConstructor
public class HistoricalGapBackfillService {

    private final HistoricalDataService historicalDataService;
    private final IBKRClientService ibkrClientService;

    private final Map<String, CompletableFuture<Integer>> pending = new ConcurrentHashMap<>();

    /**
     * Request short historical window via IBKR {@code reqHistoricalData}.
     *
     * @return bars saved, or 0 on failure/timeout
     */
    public int backfillSymbol(String symbol, int durationMinutes) {
        if (!ibkrClientService.isConnected()) {
            return 0;
        }
        String sym = symbol.toUpperCase();
        CompletableFuture<Integer> future = new CompletableFuture<>();
        pending.put(sym, future);
        var jobOpt = historicalDataService.startRecovery(sym, durationMinutes, saved -> {
            CompletableFuture<Integer> f = pending.remove(sym);
            if (f != null) {
                f.complete(saved != null ? saved : 0);
            }
        });
        if (jobOpt.isEmpty()) {
            pending.remove(sym);
            return 0;
        }
        ibkrClientService.fireRecoveryHistoricalRequest(jobOpt.get(), durationMinutes);
        try {
            return future.get(90, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("Recovery backfill timeout for {}: {}", sym, e.getMessage());
            pending.remove(sym);
            return 0;
        }
    }

    public int backfillSymbols(Iterable<String> symbols, int durationMinutes) {
        AtomicInteger total = new AtomicInteger();
        for (String sym : symbols) {
            total.addAndGet(backfillSymbol(sym, durationMinutes));
        }
        return total.get();
    }
}
