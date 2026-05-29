package com.tradingbot.ibkr;

import com.ib.client.Bar;
import com.ib.client.Contract;
import com.ib.client.Decimal;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.models.Candle;
import com.tradingbot.candle.CandleWriteService;
import com.tradingbot.services.MarketTime;
import com.tradingbot.services.TradingPipelineService;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

@Slf4j
@Service
public class HistoricalDataService {

    public static final int HISTORICAL_REQ_ID_BASE = 9001;
    public static final int HISTORICAL_REQ_ID_MAX = 9100;

    private static final DateTimeFormatter BAR_TIME = DateTimeFormatter.ofPattern("yyyyMMdd HH:mm:ss");

    private final CandleWriteService candleWriteService;
    private final TradingProperties tradingProperties;
    private final TradingPipelineService tradingPipelineService;
    private final SymbolContextRegistry symbolContextRegistry;

    private final Deque<String> symbolQueue = new ArrayDeque<>();
    private final Map<Integer, String> activeReqSymbols = new ConcurrentHashMap<>();
    private final Map<Integer, List<Candle>> pendingByReqId = new ConcurrentHashMap<>();
    private final AtomicInteger nextReqId = new AtomicInteger(HISTORICAL_REQ_ID_BASE);
    private final AtomicBoolean batchActive = new AtomicBoolean(false);
    private Runnable batchCompleteCallback;
    private final Map<Integer, Consumer<Integer>> onDemandCallbacks = new ConcurrentHashMap<>();
    private final Map<Integer, String> recoveryDurationByReqId = new ConcurrentHashMap<>();

    public HistoricalDataService(CandleWriteService candleWriteService,
                                 TradingProperties tradingProperties,
                                 @Lazy TradingPipelineService tradingPipelineService,
                                 SymbolContextRegistry symbolContextRegistry) {
        this.candleWriteService = candleWriteService;
        this.tradingProperties = tradingProperties;
        this.tradingPipelineService = tradingPipelineService;
        this.symbolContextRegistry = symbolContextRegistry;
    }

    public synchronized boolean startBatch(List<String> symbols, Runnable onComplete) {
        if (!batchActive.compareAndSet(false, true)) {
            log.warn("Historical batch preload already in progress");
            return false;
        }
        symbolQueue.clear();
        activeReqSymbols.clear();
        pendingByReqId.clear();
        nextReqId.set(HISTORICAL_REQ_ID_BASE);
        for (String symbol : symbols) {
            symbolQueue.addLast(symbol.toUpperCase());
        }
        batchCompleteCallback = onComplete;
        log.info("Starting batch historical preload for {} symbols", symbols.size());
        return true;
    }

    public synchronized Optional<HistoricalPreloadJob> pollNextJob() {
        String symbol = symbolQueue.pollFirst();
        if (symbol == null) {
            return Optional.empty();
        }
        int reqId = nextReqId.getAndIncrement();
        activeReqSymbols.put(reqId, symbol);
        pendingByReqId.put(reqId, new ArrayList<>());
        return Optional.of(new HistoricalPreloadJob(reqId, symbol, buildStockContract(symbol)));
    }

    public boolean isHistoricalRequest(int reqId) {
        return reqId >= HISTORICAL_REQ_ID_BASE && reqId < HISTORICAL_REQ_ID_MAX;
    }

    public synchronized boolean hasPendingSymbols() {
        return !symbolQueue.isEmpty();
    }

    /** Phase 212 — short rolling recovery window (seconds-based IBKR duration). */
    public synchronized Optional<HistoricalPreloadJob> startRecovery(
            String symbol,
            int durationMinutes,
            Consumer<Integer> onComplete
    ) {
        if (batchActive.get()) {
            log.warn("Cannot start recovery historical for {} — batch in progress", symbol);
            return Optional.empty();
        }
        String sym = symbol.toUpperCase();
        int reqId = nextReqId.getAndIncrement();
        activeReqSymbols.put(reqId, sym);
        pendingByReqId.put(reqId, new ArrayList<>());
        recoveryDurationByReqId.put(reqId, toIbkrDuration(durationMinutes));
        onDemandCallbacks.put(reqId, onComplete);
        log.info("Recovery historical request for {} (reqId={}, duration={})",
                sym, reqId, recoveryDurationByReqId.get(reqId));
        return Optional.of(new HistoricalPreloadJob(reqId, sym, buildStockContract(sym)));
    }

    public String recoveryDurationForReqId(int reqId) {
        return recoveryDurationByReqId.getOrDefault(reqId, "1800 S");
    }

    private static String toIbkrDuration(int durationMinutes) {
        int seconds = Math.max(300, Math.min(3600, durationMinutes * 60));
        return seconds + " S";
    }

    public synchronized Optional<HistoricalPreloadJob> startOnDemand(String symbol, Consumer<Integer> onComplete) {
        if (batchActive.get()) {
            log.warn("Cannot start on-demand historical for {} — batch in progress", symbol);
            return Optional.empty();
        }
        String sym = symbol.toUpperCase();
        int reqId = nextReqId.getAndIncrement();
        activeReqSymbols.put(reqId, sym);
        pendingByReqId.put(reqId, new ArrayList<>());
        onDemandCallbacks.put(reqId, onComplete);
        log.info("On-demand historical request for {} (reqId={})", sym, reqId);
        return Optional.of(new HistoricalPreloadJob(reqId, sym, buildStockContract(sym)));
    }

    public boolean isBatchActive() {
        return batchActive.get();
    }

    void onHistoricalBar(int reqId, Bar bar) {
        String symbol = activeReqSymbols.get(reqId);
        if (symbol == null || bar == null) {
            return;
        }
        pendingByReqId.computeIfAbsent(reqId, k -> new ArrayList<>())
                .add(toCandle(bar, symbol));
    }

    void onHistoricalDataEnd(int reqId) {
        String symbol = activeReqSymbols.remove(reqId);
        if (symbol == null) {
            return;
        }
        List<Candle> pending = pendingByReqId.remove(reqId);
        int saved = persistHistoricalBars(symbol, pending != null ? pending : List.of());
        log.info("Historical preload complete: {} candles saved for {}", saved, symbol);
        if (saved > 0) {
            symbolContextRegistry.markHistoricalLoaded(symbol);
        }
        recoveryDurationByReqId.remove(reqId);
        Consumer<Integer> onDemand = onDemandCallbacks.remove(reqId);
        if (onDemand != null) {
            onDemand.accept(saved);
        }
    }

    void onHistoricalFailed(int reqId) {
        String symbol = activeReqSymbols.remove(reqId);
        pendingByReqId.remove(reqId);
        recoveryDurationByReqId.remove(reqId);
        Consumer<Integer> onDemand = onDemandCallbacks.remove(reqId);
        if (onDemand != null) {
            onDemand.accept(0);
        }
        if (symbol != null) {
            log.warn("Historical preload failed for {} (reqId={})", symbol, reqId);
        }
    }

    public synchronized void finishBatchIfDone() {
        if (!symbolQueue.isEmpty() || !activeReqSymbols.isEmpty()) {
            return;
        }
        if (!batchActive.compareAndSet(true, false)) {
            return;
        }
        tradingPipelineService.enableLiveSignals();
        log.info("Batch historical preload finished — live signals enabled");
        if (batchCompleteCallback != null) {
            batchCompleteCallback.run();
            batchCompleteCallback = null;
        }
    }

    public Contract buildStockContract(String symbol) {
        Contract contract = new Contract();
        contract.symbol(symbol);
        contract.secType("STK");
        contract.exchange("SMART");
        contract.currency("USD");
        return contract;
    }

    private int persistHistoricalBars(String symbol, List<Candle> pendingBars) {
        if (pendingBars.isEmpty()) {
            log.warn("No historical bars received from IBKR for {}", symbol);
            return 0;
        }

        List<Candle> sorted = pendingBars.stream()
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();

        int limit = tradingProperties.getCandleHistorySize();
        List<Candle> toSave = sorted.size() > limit
                ? sorted.subList(sorted.size() - limit, sorted.size())
                : sorted;

        String timeframe = tradingProperties.getTimeframe();
        int saved = 0;
        for (Candle candle : toSave) {
            if (candleWriteService.saveIfAbsent(candle).isPresent()) {
                saved++;
            }
        }
        return saved;
    }

    private Candle toCandle(Bar bar, String symbol) {
        LocalDateTime openTime = parseBarTime(bar.time());
        int minutes = tradingProperties.getCandleMinutes();

        return Candle.builder()
                .symbol(symbol)
                .timeframe(tradingProperties.getTimeframe())
                .open(BigDecimal.valueOf(bar.open()))
                .high(BigDecimal.valueOf(bar.high()))
                .low(BigDecimal.valueOf(bar.low()))
                .close(BigDecimal.valueOf(bar.close()))
                .volume(parseVolume(bar.volume()))
                .openTime(openTime)
                .closeTime(openTime.plusMinutes(minutes))
                .build();
    }

    private LocalDateTime parseBarTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return MarketTime.nowLocal();
        }
        String normalized = raw.trim();
        if (normalized.length() >= 17) {
            normalized = normalized.substring(0, 17);
        }
        try {
            return LocalDateTime.parse(normalized, BAR_TIME);
        } catch (DateTimeParseException e) {
            log.warn("Could not parse bar time '{}', using market now", raw);
            return MarketTime.nowLocal();
        }
    }

    private long parseVolume(Decimal volume) {
        if (volume == null) {
            return 0L;
        }
        return volume.value().longValue();
    }

    public record HistoricalPreloadJob(int reqId, String symbol, Contract contract) {
    }
}
