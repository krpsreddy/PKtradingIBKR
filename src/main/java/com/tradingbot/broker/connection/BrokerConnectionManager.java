package com.tradingbot.broker.connection;

import com.tradingbot.broker.event.BrokerEventPublisher;
import com.tradingbot.broker.model.*;
import com.tradingbot.broker.registry.SubscriptionRegistry;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.ibkr.SubscriptionManagerService;
import com.tradingbot.ibkr.stream.DynamicLiveStreamOrchestrator;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import com.tradingbot.dataintegrity.recovery.ReconnectRecoveryCoordinator;
import com.tradingbot.intelligence.live.runtime.RuntimeBootstrapService;
import com.tradingbot.services.TradingSymbolService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Thread-safe dynamic IBKR profile switching without backend restart.
 */
@Slf4j
@Service
public class BrokerConnectionManager implements BrokerConnectionLifecycleListener {

    private static final long READY_TIMEOUT_MS = 45_000;
    private static final Path LAST_PROFILE_FILE = Path.of("data", "broker-last-profile.txt");

    private final BrokerProfileCatalog catalog;
    private final IBKRClientService ibkrClientService;
    private final SubscriptionRegistry subscriptionRegistry;
    private final SubscriptionManagerService subscriptionManager;
    private final BrokerEventPublisher eventPublisher;
    private final ObjectProvider<RuntimeBootstrapService> runtimeBootstrapProvider;
    private final ObjectProvider<TradingSymbolService> tradingSymbolServiceProvider;
    private final ObjectProvider<DynamicLiveStreamOrchestrator> streamOrchestratorProvider;
    private final ObjectProvider<ReconnectRecoveryCoordinator> reconnectRecoveryProvider;

    private final Object switchLock = new Object();
    private final AtomicBoolean switchInProgress = new AtomicBoolean(false);
    private final AtomicBoolean reconnectInProgress = new AtomicBoolean(false);
    private final AtomicBoolean backoffReconnectScheduled = new AtomicBoolean(false);
    private final AtomicReference<BrokerProfile> activeProfile = new AtomicReference<>();
    private final AtomicReference<BrokerConnectionPhase> phase = new AtomicReference<>(BrokerConnectionPhase.DISCONNECTED);
    private final AtomicReference<CompletableFuture<Void>> readyFuture = new AtomicReference<>();
    private volatile Long connectStartedAt;
    private volatile Long latencyMs;
    private volatile String lastError;

    public BrokerConnectionManager(
            BrokerProfileCatalog catalog,
            IBKRClientService ibkrClientService,
            SubscriptionRegistry subscriptionRegistry,
            SubscriptionManagerService subscriptionManager,
            BrokerEventPublisher eventPublisher,
            ObjectProvider<RuntimeBootstrapService> runtimeBootstrapProvider,
            ObjectProvider<TradingSymbolService> tradingSymbolServiceProvider,
            ObjectProvider<DynamicLiveStreamOrchestrator> streamOrchestratorProvider,
            ObjectProvider<ReconnectRecoveryCoordinator> reconnectRecoveryProvider
    ) {
        this.catalog = catalog;
        this.ibkrClientService = ibkrClientService;
        this.subscriptionRegistry = subscriptionRegistry;
        this.subscriptionManager = subscriptionManager;
        this.eventPublisher = eventPublisher;
        this.runtimeBootstrapProvider = runtimeBootstrapProvider;
        this.tradingSymbolServiceProvider = tradingSymbolServiceProvider;
        this.streamOrchestratorProvider = streamOrchestratorProvider;
        this.reconnectRecoveryProvider = reconnectRecoveryProvider;
    }

    @PostConstruct
    public void init() {
        ibkrClientService.setConnectionLifecycleListener(this);
        BrokerProfile profile = catalog.resolveStartupProfile(loadLastProfileId());
        log.info("BrokerConnectionManager starting profile={} port={}", profile.id(), profile.port());
        connectInternal(profile, false);
    }

    public CompletableFuture<Void> connect(String profileId) {
        return switchProfile(profileId);
    }

    public CompletableFuture<Void> switchProfile(String profileId) {
        BrokerProfile target = catalog.require(profileId);
        synchronized (switchLock) {
            if (!switchInProgress.compareAndSet(false, true)) {
                return CompletableFuture.failedFuture(new IllegalStateException("Broker switch already in progress"));
            }
            try {
                BrokerProfile current = activeProfile.get();
                if (current != null && current.id().equals(target.id()) && ibkrClientService.isConnected()) {
                    return CompletableFuture.completedFuture(null);
                }

                publish(BrokerEventType.BROKER_CONNECTING, target);
                phase.set(BrokerConnectionPhase.CONNECTING);

                log.info("Switching broker profile {}:{} -> {}:{}", 
                        current != null ? current.id() : "none",
                        current != null ? current.port() : 0,
                        target.id(), target.port());

                subscriptionRegistry.captureFrom(ibkrClientService, subscriptionManager);
                ibkrClientService.setAutoReconnectEnabled(target.autoReconnect());
                ibkrClientService.gracefulDisconnectForSwitch();

                CompletableFuture<Void> ready = connectInternal(target, true);
                return ready.whenComplete((v, ex) -> {
                    switchInProgress.set(false);
                    if (ex != null) {
                        phase.set(BrokerConnectionPhase.RECONNECT_FAILED);
                        lastError = ex.getMessage();
                        publish(BrokerEventType.BROKER_RECONNECT_FAILED, target);
                    } else {
                        phase.set(BrokerConnectionPhase.SWITCHED);
                        publish(BrokerEventType.BROKER_SWITCHED, target);
                        saveLastProfileId(target.id());
                    }
                });
            } catch (Exception e) {
                switchInProgress.set(false);
                return CompletableFuture.failedFuture(e);
            }
        }
    }

    public void disconnect() {
        synchronized (switchLock) {
            subscriptionRegistry.captureFrom(ibkrClientService, subscriptionManager);
            ibkrClientService.setAutoReconnectEnabled(false);
            ibkrClientService.gracefulDisconnectForSwitch();
            activeProfile.set(null);
            phase.set(BrokerConnectionPhase.DISCONNECTED);
            publish(BrokerEventType.BROKER_DISCONNECTED, null);
        }
    }

    public CompletableFuture<Void> reconnect() {
        BrokerProfile profile = activeProfile.get();
        if (profile == null) {
            profile = catalog.defaultProfile();
        }
        if (!reconnectInProgress.compareAndSet(false, true)) {
            return CompletableFuture.completedFuture(null);
        }
        BrokerProfile p = profile;
        CompletableFuture<Void> fut;
        BrokerProfile current = activeProfile.get();
        if (current != null && current.id().equals(p.id()) && !ibkrClientService.isConnected()) {
            synchronized (switchLock) {
                publish(BrokerEventType.BROKER_CONNECTING, p);
                phase.set(BrokerConnectionPhase.CONNECTING);
                fut = connectInternal(p, true);
            }
        } else {
            fut = switchProfile(p.id());
        }
        return fut.whenComplete((v, e) -> reconnectInProgress.set(false));
    }

    public BrokerConnectionStatusDto status() {
        BrokerProfile profile = activeProfile.get();
        String mode = profile != null ? profile.mode().name() : "—";
        String name = profile != null ? profile.name() : "—";
        String profileId = profile != null ? profile.id() : "";
        return new BrokerConnectionStatusDto(
                phase.get().name(),
                phase.get(),
                mode,
                name,
                profileId,
                profile != null ? profile.host() : "",
                profile != null ? profile.port() : 0,
                ibkrClientService.isConnected() ? ibkrClientService.effectiveClientId()
                        : (profile != null ? profile.clientId() : 0),
                ibkrClientService.isConnected(),
                ibkrClientService.isReadyForOrders(),
                ibkrClientService.isLiveStreaming(),
                latencyMs,
                subscriptionRegistry.size(),
                lastError,
                System.currentTimeMillis()
        );
    }

    public BrokerProfile activeProfile() {
        return activeProfile.get();
    }

    @Override
    public void onSocketConnected(BrokerProfile profile) {
        publish(BrokerEventType.BROKER_CONNECTED, profile);
        phase.set(BrokerConnectionPhase.CONNECTED);
    }

    @Override
    public void onReady(BrokerProfile profile) {
        if (connectStartedAt != null) {
            latencyMs = System.currentTimeMillis() - connectStartedAt;
        }
        phase.set(BrokerConnectionPhase.RESTORING_STREAMS);
        publish(BrokerEventType.BROKER_RESTORING_STREAMS, profile);

        Thread restoreThread = new Thread(() -> {
            try {
                int restored = 0;
                DynamicLiveStreamOrchestrator orchestrator = streamOrchestratorProvider.getIfAvailable();
                if (orchestrator != null && orchestrator.isDynamicEnabled()) {
                    // Phase 216 — streams start via IbkrReadinessGate → StreamHealthOrchestrator.bootstrapAfterReady
                    log.info("Dynamic streams delegated to IBKR_READY orchestrator");
                } else {
                    restored = subscriptionRegistry.restoreAll(ibkrClientService, subscriptionManager);
                    if (restored == 0) {
                        ibkrClientService.bootstrapDefaultSubscriptions();
                    }
                    log.info("Restored {} subscriptions after connect", restored);
                    tradingSymbolServiceProvider.ifAvailable(TradingSymbolService::activateBrokerRuntimeForAllEnabled);
                    reconnectRecoveryProvider.ifAvailable(ReconnectRecoveryCoordinator::onBrokerReady);
                }
                runtimeBootstrapProvider.ifAvailable(RuntimeBootstrapService::onReconnectRecovery);
                phase.set(BrokerConnectionPhase.CONNECTED);
                publish(BrokerEventType.BROKER_CONNECTED, profile);
                CompletableFuture<Void> fut = readyFuture.get();
                if (fut != null && !fut.isDone()) {
                    fut.complete(null);
                }
            } catch (Exception ex) {
                lastError = ex.getMessage();
                CompletableFuture<Void> fut = readyFuture.get();
                if (fut != null && !fut.isDone()) {
                    fut.completeExceptionally(ex);
                }
            }
        }, "broker-restore-streams");
        restoreThread.setDaemon(true);
        restoreThread.start();
    }

    @Override
    public void onDisconnected() {
        phase.set(BrokerConnectionPhase.DISCONNECTED);
        reconnectRecoveryProvider.ifAvailable(ReconnectRecoveryCoordinator::onBrokerDisconnected);
        publish(BrokerEventType.BROKER_DISCONNECTED, activeProfile.get());
        CompletableFuture<Void> fut = readyFuture.get();
        if (fut != null && !fut.isDone()) {
            fut.completeExceptionally(new IllegalStateException("IBKR disconnected during connect"));
        }
        if (!switchInProgress.get() && activeProfile.get() != null
                && activeProfile.get().autoReconnect() && !reconnectInProgress.get()) {
            scheduleBackoffReconnect();
        }
    }

    private void scheduleBackoffReconnect() {
        if (!backoffReconnectScheduled.compareAndSet(false, true)) {
            return;
        }
        Thread t = new Thread(() -> {
            try {
                Thread.sleep(5_000);
                if (!ibkrClientService.isConnected() && activeProfile.get() != null && !reconnectInProgress.get()) {
                    reconnect();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                backoffReconnectScheduled.set(false);
            }
        }, "broker-backoff-reconnect");
        t.setDaemon(true);
        t.start();
    }

    private CompletableFuture<Void> connectInternal(BrokerProfile profile, boolean waitReady) {
        activeProfile.set(profile);
        connectStartedAt = System.currentTimeMillis();
        latencyMs = null;
        lastError = null;

        CompletableFuture<Void> future = new CompletableFuture<>();
        readyFuture.set(future);

        ibkrClientService.connectWithProfile(profile);

        if (!waitReady) {
            return CompletableFuture.completedFuture(null);
        }

        Thread waiter = new Thread(() -> {
            try {
                future.get(READY_TIMEOUT_MS, TimeUnit.MILLISECONDS);
            } catch (Exception e) {
                if (!future.isDone()) {
                    future.completeExceptionally(e);
                }
            }
        }, "broker-ready-wait");
        waiter.setDaemon(true);
        waiter.start();
        return future;
    }

    private void publish(BrokerEventType type, BrokerProfile profile) {
        BrokerConnectionStatusDto status = status();
        if (profile != null) {
            status = new BrokerConnectionStatusDto(
                    status.status(),
                    phase.get(),
                    profile.mode().name(),
                    profile.name(),
                    profile.id(),
                    profile.host(),
                    profile.port(),
                    profile.clientId(),
                    status.connected(),
                    status.ready(),
                    status.streaming(),
                    status.latencyMs(),
                    status.subscriptionCount(),
                    lastError,
                    System.currentTimeMillis()
            );
        }
        eventPublisher.publish(type, status);
    }

    private Optional<String> loadLastProfileId() {
        try {
            if (Files.exists(LAST_PROFILE_FILE)) {
                String id = Files.readString(LAST_PROFILE_FILE).trim();
                if (!id.isBlank()) {
                    return Optional.of(id);
                }
            }
        } catch (IOException e) {
            log.debug("No last broker profile: {}", e.getMessage());
        }
        return Optional.empty();
    }

    private void saveLastProfileId(String id) {
        try {
            Files.createDirectories(LAST_PROFILE_FILE.getParent());
            Files.writeString(LAST_PROFILE_FILE, id);
        } catch (IOException e) {
            log.warn("Could not persist last broker profile: {}", e.getMessage());
        }
    }
}
