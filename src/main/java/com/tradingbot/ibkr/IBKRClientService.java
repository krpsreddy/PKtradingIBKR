package com.tradingbot.ibkr;

import com.ib.client.Contract;
import com.ib.client.EClientSocket;
import com.ib.client.EJavaSignal;
import com.ib.client.EReader;
import com.ib.client.TickType;
import com.tradingbot.candle.CandleAggregatorService;
import com.tradingbot.config.IBKRProperties;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.services.MarketTime;
import com.tradingbot.services.TradingSymbolService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
public class IBKRClientService {

    private static final int TICKER_ID_BASE = 1;
    private static final long HISTORICAL_PACING_MS = 350;

    private final IBKRProperties properties;
    private final TradingProperties tradingProperties;
    private final CandleAggregatorService candleAggregatorService;
    private final HistoricalDataService historicalDataService;
    private final ObjectProvider<SubscriptionManagerService> subscriptionManagerProvider;
    private final ObjectProvider<TradingSymbolService> tradingSymbolServiceProvider;

    private final EJavaSignal signal = new EJavaSignal();
    private IBKRWrapper wrapper;
    private EClientSocket client;
    private EReader reader;
    private Thread readerThread;

    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicBoolean ready = new AtomicBoolean(false);
    private final AtomicBoolean liveSubscribed = new AtomicBoolean(false);
    private final AtomicInteger reconnectAttempts = new AtomicInteger(0);
    private static final int MAX_RECONNECT_ATTEMPTS = 10;

    private final Map<Integer, String> tickerSymbols = new ConcurrentHashMap<>();
    private final Map<String, Integer> symbolToTickerId = new ConcurrentHashMap<>();
    private final Map<Integer, Double> lastPrices = new ConcurrentHashMap<>();
    private final Map<Integer, Long> lastVolumes = new ConcurrentHashMap<>();
    private final Deque<String> connectionLogs = new ArrayDeque<>();
    private static final int MAX_LOGS = 50;

    public IBKRClientService(IBKRProperties properties,
                             TradingProperties tradingProperties,
                             CandleAggregatorService candleAggregatorService,
                             HistoricalDataService historicalDataService,
                             ObjectProvider<SubscriptionManagerService> subscriptionManagerProvider,
                             ObjectProvider<TradingSymbolService> tradingSymbolServiceProvider) {
        this.properties = properties;
        this.tradingProperties = tradingProperties;
        this.candleAggregatorService = candleAggregatorService;
        this.historicalDataService = historicalDataService;
        this.subscriptionManagerProvider = subscriptionManagerProvider;
        this.tradingSymbolServiceProvider = tradingSymbolServiceProvider;
    }

    public EClientSocket getApiClient() {
        return client;
    }

    @PostConstruct
    public void start() {
        try {
            wrapper = new IBKRWrapper(this, historicalDataService);
            client = new EClientSocket(wrapper, signal);
            connect();
        } catch (Throwable e) {
            log.error("IBKR initial connection failed — app will continue; reconnect scheduled", e);
            scheduleReconnect();
        }
    }

    @PreDestroy
    public void shutdown() {
        disconnect();
    }

    public synchronized void connect() {
        if (connected.get()) {
            return;
        }
        log.info("Connecting to IB Gateway at {}:{} clientId={}",
                properties.getHost(), properties.getPort(), properties.getClientId());
        client.eConnect(properties.getHost(), properties.getPort(), properties.getClientId());
        if (!client.isConnected()) {
            scheduleReconnect();
            return;
        }
        startReader();
        connected.set(true);
        reconnectAttempts.set(0);
        log.info("IBKR socket connected");
        addConnectionLog("Connected to IB Gateway at " + properties.getHost() + ":" + properties.getPort());
    }

    private void startReader() {
        reader = new EReader(client, signal);
        reader.start();
        readerThread = new Thread(() -> {
            while (client.isConnected()) {
                signal.waitForSignal();
                try {
                    reader.processMsgs();
                } catch (Exception e) {
                    log.error("Error processing IBKR messages", e);
                }
            }
        }, "ibkr-reader");
        readerThread.setDaemon(true);
        readerThread.start();
    }

    public synchronized void disconnect() {
        connected.set(false);
        ready.set(false);
        liveSubscribed.set(false);
        if (client != null && client.isConnected()) {
            for (Integer tickerId : tickerSymbols.keySet()) {
                client.cancelMktData(tickerId);
            }
            tickerSymbols.clear();
            symbolToTickerId.clear();
            subscriptionManagerProvider.ifAvailable(SubscriptionManagerService::clearAll);
            client.eDisconnect();
            log.info("Disconnected from IB Gateway");
        }
    }

    void onConnected() {
        log.info("IBKR connectAck received");
    }

    void onReady() {
        if (!ready.compareAndSet(false, true)) {
            return;
        }
        int dataType = properties.getMarketDataType();
        client.reqMarketDataType(dataType);
        log.info("IBKR market data type set to {} (1=live, 3=delayed)", dataType);
        requestHistoricalThenLive();
    }

    private void requestHistoricalThenLive() {
        List<String> symbols = resolveWatchlistSymbols();
        if (!historicalDataService.startBatch(symbols, this::subscribeAllLiveMarketData)) {
            subscribeAllLiveMarketData();
            return;
        }
        requestNextHistorical();
    }

    private List<String> resolveWatchlistSymbols() {
        TradingSymbolService tradingSymbolService = tradingSymbolServiceProvider.getIfAvailable();
        if (tradingSymbolService != null) {
            List<String> preload = tradingSymbolService.findPreloadOnStartup().stream()
                    .map(s -> s.getSymbol().toUpperCase())
                    .distinct()
                    .toList();
            if (!preload.isEmpty()) {
                return preload;
            }
        }
        List<String> symbols = new ArrayList<>();
        symbols.add(properties.getSymbol());
        return symbols;
    }

    private List<String> resolveLiveSubscribeSymbols() {
        TradingSymbolService tradingSymbolService = tradingSymbolServiceProvider.getIfAvailable();
        if (tradingSymbolService != null) {
            List<String> live = tradingSymbolService.findSubscribeLive().stream()
                    .map(s -> s.getSymbol().toUpperCase())
                    .distinct()
                    .toList();
            if (!live.isEmpty()) {
                return live;
            }
        }
        return resolveWatchlistSymbols();
    }

    private synchronized void requestNextHistorical() {
        var jobOpt = historicalDataService.pollNextJob();
        if (jobOpt.isEmpty()) {
            historicalDataService.finishBatchIfDone();
            return;
        }
        HistoricalDataService.HistoricalPreloadJob job = jobOpt.get();
        client.reqHistoricalData(
                job.reqId(),
                job.contract(),
                "",
                tradingProperties.getIbkrHistoricalDuration(),
                "5 mins",
                "TRADES",
                1,
                1,
                false,
                null
        );
        log.info("Requested historical 5m bars for {} (reqId={})", job.symbol(), job.reqId());
        addConnectionLog("Historical preload started: " + job.symbol());
    }

    private void subscribeAllLiveMarketData() {
        if (!liveSubscribed.compareAndSet(false, true)) {
            return;
        }
        List<String> symbols = resolveLiveSubscribeSymbols();
        int tickerId = TICKER_ID_BASE;
        for (String symbol : symbols) {
            final int id = tickerId;
            subscribeToSymbol(symbol, id);
            subscriptionManagerProvider.ifAvailable(mgr -> mgr.registerSubscription(symbol, id));
            tickerId++;
            pause(HISTORICAL_PACING_MS);
        }
        addConnectionLog("Live streaming enabled for " + symbols.size() + " symbols");
    }

    void onHistoricalBar(int reqId, com.ib.client.Bar bar) {
        historicalDataService.onHistoricalBar(reqId, bar);
    }

    void onHistoricalDataEnd(int reqId) {
        historicalDataService.onHistoricalDataEnd(reqId);
        continueHistoricalBatch();
    }

    void onHistoricalFailed(int reqId) {
        historicalDataService.onHistoricalFailed(reqId);
        continueHistoricalBatch();
    }

    private void continueHistoricalBatch() {
        pause(HISTORICAL_PACING_MS);
        if (historicalDataService.hasPendingSymbols()) {
            requestNextHistorical();
        } else {
            historicalDataService.finishBatchIfDone();
        }
    }

    void onDisconnected() {
        connected.set(false);
        ready.set(false);
        liveSubscribed.set(false);
        scheduleReconnect();
    }

    private void scheduleReconnect() {
        int attempt = reconnectAttempts.incrementAndGet();
        if (attempt > MAX_RECONNECT_ATTEMPTS) {
            log.error("Max IBKR reconnect attempts reached");
            return;
        }
        log.info("Scheduling IBKR reconnect attempt {}/{}", attempt, MAX_RECONNECT_ATTEMPTS);
        Thread reconnectThread = new Thread(() -> {
            try {
                Thread.sleep(5000L * attempt);
                wrapper = new IBKRWrapper(this, historicalDataService);
                client = new EClientSocket(wrapper, signal);
                ready.set(false);
                liveSubscribed.set(false);
                connect();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Throwable e) {
                log.error("IBKR reconnect attempt failed", e);
            }
        }, "ibkr-reconnect");
        reconnectThread.setDaemon(true);
        reconnectThread.start();
    }

    public void subscribeToSymbol(String symbol, int tickerId) {
        String sym = symbol.toUpperCase();
        Contract contract = historicalDataService.buildStockContract(sym);
        tickerSymbols.put(tickerId, sym);
        symbolToTickerId.put(sym, tickerId);

        client.reqMktData(tickerId, contract, "", false, false, null);
        log.info("Subscribed to live market data: {} (tickerId={})", sym, tickerId);
        addConnectionLog("Subscribed live stream for " + sym);
    }

    public void fireHistoricalRequest(HistoricalDataService.HistoricalPreloadJob job) {
        if (!isConnected()) {
            log.warn("Cannot request historical for {} — not connected", job.symbol());
            return;
        }
        client.reqHistoricalData(
                job.reqId(),
                job.contract(),
                "",
                tradingProperties.getIbkrHistoricalDuration(),
                "5 mins",
                "TRADES",
                1,
                1,
                false,
                null
        );
        log.info("Requested on-demand historical 5m bars for {} (reqId={})", job.symbol(), job.reqId());
        addConnectionLog("Historical load started: " + job.symbol());
    }

    public boolean isSubscribed(String symbol) {
        return symbolToTickerId.containsKey(symbol.toUpperCase());
    }

    void onTickPrice(int tickerId, int field, double price) {
        if (price <= 0) {
            return;
        }
        String symbol = tickerSymbols.get(tickerId);
        if (symbol == null) {
            return;
        }

        if (isLastPriceField(field)) {
            lastPrices.put(tickerId, price);
            log.debug("Tick price {} LAST={}", symbol, price);
            candleAggregatorService.onTick(symbol, price, lastVolumes.getOrDefault(tickerId, 0L));
        }
    }

    void onTickSize(int tickerId, int field, double size) {
        if (size <= 0) {
            return;
        }
        String symbol = tickerSymbols.get(tickerId);
        if (symbol == null) {
            return;
        }
        if (field == TickType.LAST_SIZE.index() || field == TickType.DELAYED_LAST_SIZE.index()
                || field == TickType.VOLUME.index()) {
            long volume = (long) size;
            lastVolumes.put(tickerId, volume);
            Double lastPrice = lastPrices.get(tickerId);
            if (lastPrice != null) {
                candleAggregatorService.onTick(symbol, lastPrice, volume);
            }
        }
    }

    private static boolean isLastPriceField(int field) {
        return field == TickType.LAST.index()
                || field == TickType.DELAYED_LAST.index()
                || field == TickType.CLOSE.index()
                || field == TickType.DELAYED_CLOSE.index();
    }

    private static void pause(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public boolean isConnected() {
        return connected.get() && client != null && client.isConnected();
    }

    public boolean isLiveStreaming() {
        return liveSubscribed.get() && isConnected();
    }

    public Double getLastPrice(String symbol) {
        for (Map.Entry<Integer, String> entry : tickerSymbols.entrySet()) {
            if (symbol.equalsIgnoreCase(entry.getValue())) {
                return lastPrices.get(entry.getKey());
            }
        }
        return null;
    }

    public void cancelSymbolSubscription(String symbol, int tickerId) {
        if (client != null && client.isConnected()) {
            client.cancelMktData(tickerId);
        }
        tickerSymbols.remove(tickerId);
        symbolToTickerId.remove(symbol.toUpperCase());
        lastPrices.remove(tickerId);
        lastVolumes.remove(tickerId);
        addConnectionLog("Unsubscribed live stream for " + symbol);
    }

    public List<String> getConnectionLogs() {
        synchronized (connectionLogs) {
            return new ArrayList<>(connectionLogs);
        }
    }

    private void addConnectionLog(String message) {
        String line = MarketTime.formatIsoNow() + " — " + message;
        synchronized (connectionLogs) {
            connectionLogs.addLast(line);
            while (connectionLogs.size() > MAX_LOGS) {
                connectionLogs.removeFirst();
            }
        }
    }
}
