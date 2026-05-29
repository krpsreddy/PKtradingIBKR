package com.tradingbot.ibkr.stream;

import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.ibkr.SubscriptionManagerService;
import com.tradingbot.ibkr.connection.IbkrReadinessGate;
import com.tradingbot.ibkr.connection.VerifiedStreamRegistry;
import com.tradingbot.ibkr.diagnostics.StreamPipelineDiagnostics;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Phase 216 — verify ticks, ghost cleanup, auto-recover, periodic reconcile.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@EnableConfigurationProperties(LiveStreamProperties.class)
public class StreamHealthOrchestrator {

    private final LiveStreamProperties properties;
    private final IbkrReadinessGate readinessGate;
    private final VerifiedStreamRegistry verifiedStreams;
    private final IBKRClientService ibkrClientService;
    private final SubscriptionManagerService subscriptionManager;
    private final DynamicLiveStreamOrchestrator streamOrchestrator;
    private final StreamPipelineDiagnostics streamDiagnostics;

    @PostConstruct
    void wireReadiness() {
        readinessGate.onIbkrReady(() -> {
            log.info("IBKR_READY — starting self-healing stream orchestration");
            streamOrchestrator.bootstrapAfterReady();
        });
        readinessGate.onStreamHealthy(() ->
                log.info("STREAMING_HEALTHY — verified realtime ticks active"));
    }

    @Scheduled(fixedDelayString = "${ibkr.stream.reconcile-interval-ms:30000}", initialDelay = 15_000)
    public void periodicReconcile() {
        if (!ibkrClientService.isIbkrReady()) {
            return;
        }
        int pruned = subscriptionManager.pruneOrphanRegistryEntries();
        if (pruned > 0) {
            log.warn("Pruned {} orphan subscription registry entries (ghost ledger)", pruned);
            streamDiagnostics.setRootCauseHint("C_SUBSCRIPTION_TIMING");
        }
        verifyPendingSubscriptions();
        purgeGhosts();
        if (properties.isAutoRecover()) {
            recoverUnhealthyStreams();
        }
        streamOrchestrator.reconcileWhenReady();
        if (verifiedStreams.verifiedCount() > 0) {
            readinessGate.onStreamHealthy();
            readinessGate.markStreamActive();
        } else {
            readinessGate.onStreamInactive();
        }
    }

    private void verifyPendingSubscriptions() {
        long verifyMs = properties.getVerifyTimeoutSeconds() * 1000L;
        for (String sym : verifiedStreams.pendingVerificationPast(verifyMs)) {
            log.warn("Stream verification failed (no tick in {}s): {}", properties.getVerifyTimeoutSeconds(), sym);
            if (subscriptionManager.isSubscribed(sym)) {
                subscriptionManager.unsubscribe(sym);
            }
            verifiedStreams.clearGhost(sym);
            verifiedStreams.incrementReconnectAttempts();
        }
    }

    private void purgeGhosts() {
        verifyPendingSubscriptions();
    }

    private void recoverUnhealthyStreams() {
        long staleMs = properties.getStaleSeconds() * 1000L;
        long deadMs = properties.getDeadSeconds() * 1000L;
        List<String> targets = verifiedStreams.deadSymbols(deadMs);
        targets.addAll(verifiedStreams.staleSymbols(staleMs, deadMs));
        for (String sym : targets.stream().distinct().limit(8).toList()) {
            log.info("Auto-recover stream {}", sym);
            verifiedStreams.incrementReconnectAttempts();
            subscriptionManager.unsubscribe(sym);
            verifiedStreams.clearGhost(sym);
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            if (ibkrClientService.isIbkrReady()) {
                subscriptionManager.subscribeIfNeeded(sym);
            }
        }
    }
}
