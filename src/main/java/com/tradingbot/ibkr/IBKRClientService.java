package com.tradingbot.ibkr;

import com.ib.client.Contract;
import com.ib.client.EClientSocket;
import com.ib.client.EJavaSignal;
import com.ib.client.EReader;
import com.ib.client.TickType;
import com.tradingbot.broker.connection.BrokerConnectionLifecycleListener;
import com.tradingbot.broker.model.BrokerProfile;
import com.tradingbot.candle.CandleAggregatorService;
import com.tradingbot.config.IBKRProperties;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.services.MarketTime;
import com.tradingbot.ibkr.connection.IbkrConnectionPhase;
import com.tradingbot.ibkr.connection.IbkrReadinessGate;
import com.tradingbot.ibkr.connection.VerifiedStreamRegistry;
import com.tradingbot.ibkr.diagnostics.StreamPipelineDiagnostics;
import com.tradingbot.ibkr.stream.DynamicLiveStreamOrchestrator;
import com.tradingbot.services.TradingSymbolService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

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
    private final ObjectProvider<com.tradingbot.paper.PaperExecutionMetricsService> paperMetricsProvider;
    private final ObjectProvider<DynamicLiveStreamOrchestrator> dynamicStreamOrchestratorProvider;
    private final IbkrReadinessGate readinessGate;
    private final VerifiedStreamRegistry verifiedStreamRegistry;
    private final StreamPipelineDiagnostics streamDiagnostics;

    private final EJavaSignal signal = new EJavaSignal();
    private IBKRWrapper wrapper;
    private EClientSocket client;
    private EReader reader;
    private Thread readerThread;

    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicBoolean ready = new AtomicBoolean(false);
    private final AtomicInteger nextOrderId = new AtomicInteger(0);
    private final AtomicBoolean liveSubscribed = new AtomicBoolean(false);
    private final AtomicBoolean marketDataFallbackApplied = new AtomicBoolean(false);
    private final AtomicInteger marketDataEntitlementErrors = new AtomicInteger(0);
    private final AtomicInteger reconnectAttempts = new AtomicInteger(0);
    private static final int MAX_RECONNECT_ATTEMPTS = 10;
    private static final int MAX_CLIENT_ID_OFFSET = 32;

    private final AtomicReference<BrokerProfile> activeProfile = new AtomicReference<>();
    private final AtomicBoolean autoReconnectEnabled = new AtomicBoolean(true);
    private final AtomicBoolean managerControlled = new AtomicBoolean(true);
    private volatile BrokerConnectionLifecycleListener lifecycleListener;
    private volatile String connectHost;
    private volatile int connectPort;
    private volatile int connectClientId;
    private volatile String lastConnectProfileId;

    private final Map<Integer, String> tickerSymbols = new ConcurrentHashMap<>();
    private final Map<String, Integer> symbolToTickerId = new ConcurrentHashMap<>();
    private final Map<Integer, Double> lastPrices = new ConcurrentHashMap<>();
    private final Map<Integer, Long> lastVolumes = new ConcurrentHashMap<>();
    private final Map<Integer, Long> lastTickEpochMs = new ConcurrentHashMap<>();
    private final Map<Integer, Double> referenceClosePrices = new ConcurrentHashMap<>();
    private final Deque<String> connectionLogs = new ArrayDeque<>();
    private static final int MAX_LOGS = 50;

    public IBKRClientService(IBKRProperties properties,
                             TradingProperties tradingProperties,
                             CandleAggregatorService candleAggregatorService,
                             HistoricalDataService historicalDataService,
                             ObjectProvider<SubscriptionManagerService> subscriptionManagerProvider,
                             ObjectProvider<TradingSymbolService> tradingSymbolServiceProvider,
                             ObjectProvider<com.tradingbot.paper.PaperExecutionMetricsService> paperMetricsProvider,
                             ObjectProvider<DynamicLiveStreamOrchestrator> dynamicStreamOrchestratorProvider,
                             IbkrReadinessGate readinessGate,
                             VerifiedStreamRegistry verifiedStreamRegistry,
                             StreamPipelineDiagnostics streamDiagnostics) {
        this.properties = properties;
        this.tradingProperties = tradingProperties;
        this.candleAggregatorService = candleAggregatorService;
        this.historicalDataService = historicalDataService;
        this.subscriptionManagerProvider = subscriptionManagerProvider;
        this.tradingSymbolServiceProvider = tradingSymbolServiceProvider;
        this.paperMetricsProvider = paperMetricsProvider;
        this.dynamicStreamOrchestratorProvider = dynamicStreamOrchestratorProvider;
        this.readinessGate = readinessGate;
        this.verifiedStreamRegistry = verifiedStreamRegistry;
        this.streamDiagnostics = streamDiagnostics;
    }

    @PostConstruct
    void wireIbkrReady() {
        readinessGate.onIbkrReady(this::finalizeIbkrReady);
    }

    public EClientSocket getApiClient() {
        return client;
    }

    @PreDestroy
    public void shutdown() {
        autoReconnectEnabled.set(false);
        gracefulDisconnectForSwitch();
    }

    public void setConnectionLifecycleListener(BrokerConnectionLifecycleListener listener) {
        this.lifecycleListener = listener;
    }

    public void setAutoReconnectEnabled(boolean enabled) {
        autoReconnectEnabled.set(enabled);
    }

    public BrokerProfile getActiveProfile() {
        return activeProfile.get();
    }

    public Map<String, Integer> exportSymbolTickerMap() {
        return new HashMap<>(symbolToTickerId);
    }

    /** Dynamic profile connect — no backend restart. */
    public synchronized void connectWithProfile(BrokerProfile profile) {
        activeProfile.set(profile);
        connectHost = profile.host();
        connectPort = profile.port();
        boolean profileChanged = lastConnectProfileId == null || !profile.id().equals(lastConnectProfileId);
        lastConnectProfileId = profile.id();
        if (profileChanged || connectClientId <= 0) {
            connectClientId = profile.clientId();
        }
        managerControlled.set(true);
        ready.set(false);
        liveSubscribed.set(false);
        readinessGate.reset();

        if (client == null) {
            wrapper = new IBKRWrapper(this, historicalDataService);
            client = new EClientSocket(wrapper, signal);
        }
        connectSocket();
    }

    public synchronized void connect() {
        if (activeProfile.get() == null) {
            BrokerProfile fallback = new BrokerProfile(
                    "default", "IBKR Default",
                    properties.getHost(), properties.getPort(), properties.getClientId(),
                    properties.getPort() == properties.getLivePort()
                            ? com.tradingbot.broker.model.BrokerMode.LIVE
                            : com.tradingbot.broker.model.BrokerMode.PAPER,
                    true, true, "IBKR");
            connectWithProfile(fallback);
            return;
        }
        connectSocket();
    }

    private synchronized void connectSocket() {
        if (connected.get() && client != null && client.isConnected()) {
            return;
        }
        teardownReader();
        wrapper = new IBKRWrapper(this, historicalDataService);
        client = new EClientSocket(wrapper, signal);

        String host = connectHost != null ? connectHost : properties.getHost();
        int port = connectPort > 0 ? connectPort : properties.getPort();
        int clientId = connectClientId > 0 ? connectClientId : properties.getClientId();

        log.info("Connecting to IBKR at {}:{} clientId={} profile={}",
                host, port, clientId,
                activeProfile.get() != null ? activeProfile.get().id() : "default");
        client.eConnect(host, port, clientId);
        if (!client.isConnected()) {
            if (!managerControlled.get()) {
                scheduleReconnect();
            }
            return;
        }
        startReader();
        connected.set(true);
        reconnectAttempts.set(0);
        readinessGate.onSocketConnected();
        streamDiagnostics.recordPhase(IbkrConnectionPhase.SOCKET_CONNECTED);
        streamDiagnostics.recordLifecycle("SOCKET", "connected");
        log.info("IBKR socket connected");
        addConnectionLog("Connected to IBKR at " + host + ":" + port);
        BrokerConnectionLifecycleListener listener = lifecycleListener;
        if (listener != null && activeProfile.get() != null) {
            listener.onSocketConnected(activeProfile.get());
        }
    }

    private void startReader() {
        reader = new EReader(client, signal);
        reader.start();
        readerThread = new Thread(this::runReaderLoop, "ibkr-reader");
        readerThread.setDaemon(true);
        readerThread.start();
    }

    private void runReaderLoop() {
        while (!Thread.currentThread().isInterrupted()) {
            EReader activeReader = reader;
            EClientSocket activeClient = client;
            if (activeReader == null || activeClient == null || !activeClient.isConnected()) {
                break;
            }
            signal.waitForSignal();
            activeReader = reader;
            activeClient = client;
            if (activeReader == null || activeClient == null || !activeClient.isConnected()) {
                break;
            }
            try {
                activeReader.processMsgs();
            } catch (Exception e) {
                if (activeReader != reader || activeClient != client || !activeClient.isConnected()) {
                    break;
                }
                log.error("Error processing IBKR messages", e);
            }
        }
    }

    /** Profile switch — keeps subscription registry; clears local maps only. */
    public synchronized void gracefulDisconnectForSwitch() {
        connected.set(false);
        ready.set(false);
        liveSubscribed.set(false);
        readinessGate.reset();
        streamDiagnostics.recordPhase(IbkrConnectionPhase.DISCONNECTED);
        verifiedStreamRegistry.clearAll();
        teardownReader();
        if (client != null && client.isConnected()) {
            for (Integer tickerId : new ArrayList<>(tickerSymbols.keySet())) {
                try {
                    client.cancelMktData(tickerId);
                } catch (Exception ignored) {
                    /* socket may already be closing */
                }
            }
            tickerSymbols.clear();
            symbolToTickerId.clear();
            lastPrices.clear();
            lastVolumes.clear();
            lastTickEpochMs.clear();
            subscriptionManagerProvider.ifAvailable(SubscriptionManagerService::clearAll);
            client.eDisconnect();
            log.info("IBKR graceful disconnect for profile switch");
            addConnectionLog("Disconnected (profile switch)");
        }
    }

    public synchronized void disconnect() {
        gracefulDisconnectForSwitch();
    }

    private void teardownReader() {
        reader = null;
        Thread t = readerThread;
        readerThread = null;
        if (t != null && t.isAlive()) {
            t.interrupt();
            try {
                t.join(1500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    void onConnected() {
        log.info("IBKR connectAck received");
    }

    void onNextValidId(int orderId) {
        nextOrderId.set(orderId);
        readinessGate.onNextValidId();
        streamDiagnostics.recordPhase(readinessGate.phase());
        log.info("IBKR next order id baseline={}", orderId);
    }

    void onManagedAccounts() {
        readinessGate.onManagedAccounts();
        streamDiagnostics.recordPhase(readinessGate.phase());
    }

    void onMarketDataFarmHealthy() {
        readinessGate.onMarketDataFarmHealthy();
        streamDiagnostics.recordPhase(readinessGate.phase());
    }

    /**
     * IBKR 10168 — live/delayed API quotes unavailable (entitlement or TWS delayed-data disabled).
     */
    void onMarketDataEntitlementError(int tickerId, String errorMsg) {
        int n = marketDataEntitlementErrors.incrementAndGet();
        streamDiagnostics.recordMarketDataEntitlementError();
        if (n == 1) {
            log.error(
                    "IBKR market data entitlement missing (code 10168). "
                            + "Enable 'Delayed market data' in TWS API settings, or set ibkr.market-data-type=3, "
                            + "or add live API subscriptions. Detail: {}",
                    errorMsg
            );
            streamDiagnostics.recordLifecycle("MD_ENTITLEMENT", errorMsg != null ? errorMsg : "10168");
        } else if (n % 20 == 0) {
            log.warn("IBKR 10168 entitlement errors count={}", n);
        }
        if (properties.getMarketDataType() == 1 && marketDataFallbackApplied.compareAndSet(false, true)) {
            log.warn("Falling back to delayed market data type 3 after 10168 (requires delayed enabled in TWS)");
            if (client != null && client.isConnected()) {
                client.reqMarketDataType(3);
                addConnectionLog("Market data type fallback 1→3 (10168 entitlement)");
            }
        }
    }

    public int marketDataEntitlementErrorCount() {
        return marketDataEntitlementErrors.get();
    }

    private void finalizeIbkrReady() {
        if (!ready.compareAndSet(false, true)) {
            return;
        }
        streamDiagnostics.recordPhase(IbkrConnectionPhase.IBKR_READY);
        streamDiagnostics.recordLifecycle("IBKR_READY", "market data bootstrap");
        int dataType = properties.getMarketDataType();
        client.reqMarketDataType(dataType);
        log.info("IBKR_READY — market data type {} (1=live, 3=delayed)", dataType);

        if (managerControlled.get()) {
            BrokerConnectionLifecycleListener listener = lifecycleListener;
            BrokerProfile profile = activeProfile.get();
            if (listener != null && profile != null) {
                listener.onReady(profile);
            }
            return;
        }
        requestHistoricalThenLive();
    }

    /** First connect when registry empty — bootstrap watchlist streams. */
    public void bootstrapDefaultSubscriptions() {
        if (!liveSubscribed.compareAndSet(false, true)) {
            return;
        }
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
            List<String> live = tradingSymbolService.resolveLiveSubscribeSymbols(properties.getMaxLiveStreams());
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
        var orchestrator = dynamicStreamOrchestratorProvider.getIfAvailable();
        if (orchestrator != null && orchestrator.isDynamicEnabled()) {
            orchestrator.bootstrapLiveStreams();
            addConnectionLog("Dynamic live streams allocated (max "
                    + properties.getMaxLiveStreams() + " realtime slots)");
            return;
        }
        List<String> symbols = resolveLiveSubscribeSymbols();
        var mgr = subscriptionManagerProvider.getIfAvailable();
        if (mgr == null) {
            return;
        }
        int subscribed = 0;
        for (String symbol : symbols) {
            if (mgr.subscribeIfNeeded(symbol)) {
                subscribed++;
            }
            pause(HISTORICAL_PACING_MS);
        }
        addConnectionLog("Live streaming enabled for " + subscribed + "/" + symbols.size() + " symbols");
    }

    void onMaxTickersReached() {
        subscriptionManagerProvider.ifAvailable(SubscriptionManagerService::onTickerCapReached);
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
        streamDiagnostics.recordReconnect("DISCONNECTED", "socket closed");
        teardownReader();
        BrokerConnectionLifecycleListener listener = lifecycleListener;
        if (listener != null) {
            listener.onDisconnected();
            return;
        }
        if (autoReconnectEnabled.get()) {
            scheduleReconnect();
        }
    }

    /** IBKR error 326 — client id already in use (stale session or duplicate connect). */
    void onClientIdInUse() {
        int base = com.tradingbot.config.IbkrClientIdResolver.baseClientId(properties);
        int current = connectClientId > 0 ? connectClientId : base;
        if (current >= base + MAX_CLIENT_ID_OFFSET) {
            log.error(
                    "IBKR client id {} still in use after {} retries — stop other API clients or change ibkr.clientId",
                    current, MAX_CLIENT_ID_OFFSET
            );
            return;
        }
        connectClientId = current + 1;
        log.warn(
                "IBKR client id {} in use — next connect will use clientId={} (base ibkr.clientId={})",
                current, connectClientId, base
        );
    }

    /** Effective client id for this socket (may differ from profile after 326 recovery). */
    public int effectiveClientId() {
        return connectClientId > 0 ? connectClientId : properties.getClientId();
    }

    private void scheduleReconnect() {
        if (managerControlled.get() && !autoReconnectEnabled.get()) {
            return;
        }
        int attempt = reconnectAttempts.incrementAndGet();
        if (attempt > MAX_RECONNECT_ATTEMPTS) {
            log.error("Max IBKR reconnect attempts reached");
            return;
        }
        log.info("Scheduling IBKR reconnect attempt {}/{}", attempt, MAX_RECONNECT_ATTEMPTS);
        Thread reconnectThread = new Thread(() -> {
            try {
                Thread.sleep(5000L * attempt);
                ready.set(false);
                liveSubscribed.set(false);
                if (activeProfile.get() != null) {
                    connectWithProfile(activeProfile.get());
                } else {
                    connect();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Throwable e) {
                log.error("IBKR reconnect attempt failed", e);
            }
        }, "ibkr-reconnect");
        reconnectThread.setDaemon(true);
        reconnectThread.start();
    }

    public boolean subscribeToSymbol(String symbol, int tickerId) {
        String sym = symbol.toUpperCase();
        if (!isConnected()) {
            log.warn("Cannot subscribe {} — not connected", sym);
            streamDiagnostics.recordSubscriptionAttempt(sym, false, "not connected");
            return false;
        }
        if (!isIbkrReady()) {
            log.warn("Cannot subscribe {} — IBKR handshake incomplete", sym);
            streamDiagnostics.recordSubscriptionAttempt(sym, false, "not ready");
            return false;
        }
        Contract contract = historicalDataService.buildStockContract(sym);
        tickerSymbols.put(tickerId, sym);
        symbolToTickerId.put(sym, tickerId);

        client.reqMktData(tickerId, contract, "", false, false, null);
        log.info("Subscribed to live market data: {} (tickerId={})", sym, tickerId);
        addConnectionLog("Subscribed live stream for " + sym);
        streamDiagnostics.recordSubscriptionAttempt(sym, true, "reqMktData");
        return true;
    }

    public int activeMarketDataLineCount() {
        return tickerSymbols.size();
    }

    public void fireHistoricalRequest(HistoricalDataService.HistoricalPreloadJob job) {
        fireRecoveryHistoricalRequest(job, -1);
    }

    /** Phase 212 — recovery backfill with short duration (minutes → IBKR seconds string). */
    public void fireRecoveryHistoricalRequest(HistoricalDataService.HistoricalPreloadJob job, int durationMinutes) {
        if (!isConnected()) {
            log.warn("Cannot request historical for {} — not connected", job.symbol());
            return;
        }
        String duration = durationMinutes > 0
                ? historicalDataService.recoveryDurationForReqId(job.reqId())
                : tradingProperties.getIbkrHistoricalDuration();
        client.reqHistoricalData(
                job.reqId(),
                job.contract(),
                "",
                duration,
                "5 mins",
                "TRADES",
                1,
                1,
                false,
                null
        );
        log.info("Requested historical 5m bars for {} (reqId={}, duration={})", job.symbol(), job.reqId(), duration);
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

        if (isStreamPriceField(field)) {
            long tickMs = System.currentTimeMillis();
            lastPrices.put(tickerId, price);
            lastTickEpochMs.put(tickerId, tickMs);
            verifiedStreamRegistry.recordTick(symbol, price, tickMs);
            streamDiagnostics.recordTick(symbol, price);
            liveSubscribed.set(true);
            readinessGate.markStreamActive();
            log.debug("Tick price {} field={} price={}", symbol, field, price);
            candleAggregatorService.onTick(symbol, price, lastVolumes.getOrDefault(tickerId, 0L));
        } else if (field == TickType.CLOSE.index() || field == TickType.DELAYED_CLOSE.index()) {
            referenceClosePrices.put(tickerId, price);
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
            verifiedStreamRegistry.recordVolume(symbol, System.currentTimeMillis());
            Double lastPrice = lastPrices.get(tickerId);
            if (lastPrice != null) {
                candleAggregatorService.onTick(symbol, lastPrice, volume);
            }
        }
    }

    private static boolean isStreamPriceField(int field) {
        return field == TickType.LAST.index()
                || field == TickType.DELAYED_LAST.index()
                || field == TickType.BID.index()
                || field == TickType.ASK.index()
                || field == TickType.DELAYED_BID.index()
                || field == TickType.DELAYED_ASK.index()
                || field == TickType.MARK_PRICE.index();
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

    public boolean isReadyForOrders() {
        return isConnected() && ready.get() && nextOrderId.get() > 0;
    }

    public int allocateOrderId() {
        return nextOrderId.getAndIncrement();
    }

    void onOrderFilled(int orderId, double avgFillPrice) {
        paperMetricsProvider.ifAvailable(m -> m.onOrderFilled(orderId, avgFillPrice));
    }

    public boolean isIbkrReady() {
        return readinessGate.isIbkrReady() && isConnected();
    }

    public boolean isLiveStreaming() {
        return isConnected() && (readinessGate.isStreamHealthy() || verifiedStreamRegistry.verifiedCount() > 0);
    }

    public Double getLastPrice(String symbol) {
        Integer tickerId = symbolToTickerId.get(symbol.toUpperCase());
        if (tickerId != null) {
            return lastPrices.get(tickerId);
        }
        for (Map.Entry<Integer, String> entry : tickerSymbols.entrySet()) {
            if (symbol.equalsIgnoreCase(entry.getValue())) {
                return lastPrices.get(entry.getKey());
            }
        }
        return null;
    }

    public Long getLastVolume(String symbol) {
        Integer tickerId = symbolToTickerId.get(symbol.toUpperCase());
        if (tickerId == null) {
            for (Map.Entry<Integer, String> entry : tickerSymbols.entrySet()) {
                if (symbol.equalsIgnoreCase(entry.getValue())) {
                    tickerId = entry.getKey();
                    break;
                }
            }
        }
        return tickerId != null ? lastVolumes.get(tickerId) : null;
    }

    public Long getLastTickEpochMs(String symbol) {
        Integer tickerId = symbolToTickerId.get(symbol.toUpperCase());
        if (tickerId == null) {
            for (Map.Entry<Integer, String> entry : tickerSymbols.entrySet()) {
                if (symbol.equalsIgnoreCase(entry.getValue())) {
                    tickerId = entry.getKey();
                    break;
                }
            }
        }
        return tickerId != null ? lastTickEpochMs.get(tickerId) : null;
    }

    public Double getReferenceClose(String symbol) {
        Integer tickerId = symbolToTickerId.get(symbol.toUpperCase());
        if (tickerId != null) {
            Double ref = referenceClosePrices.get(tickerId);
            if (ref != null && ref > 0) {
                return ref;
            }
        }
        return null;
    }

    public boolean isConnectedAndStreaming() {
        return isConnected() && liveSubscribed.get();
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
