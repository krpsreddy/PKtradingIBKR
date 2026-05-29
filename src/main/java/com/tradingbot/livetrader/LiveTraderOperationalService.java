package com.tradingbot.livetrader;

import com.tradingbot.broker.connection.BrokerConnectionManager;
import com.tradingbot.dataintegrity.DataIntegritySnapshot;
import com.tradingbot.dataintegrity.ExecutionSafetyIntegrator;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.ibkr.SubscriptionManagerService;
import com.tradingbot.ibkr.connection.IbkrReadinessGate;
import com.tradingbot.ibkr.connection.VerifiedStreamRegistry;
import com.tradingbot.ibkr.stream.LiveStreamProperties;
import com.tradingbot.intelligence.live.LiveScannerService;
import com.tradingbot.livetrader.execution.ExecutionTelemetryService;
import com.tradingbot.paper.PaperExecutionResearchService;
import com.tradingbot.repository.ExecutionTelemetryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LiveTraderOperationalService {

    private final LiveTraderRuntimeState runtimeState;
    private final IBKRClientService ibkrClientService;
    private final BrokerConnectionManager brokerConnectionManager;
    private final LiveScannerService liveScannerService;
    private final PaperExecutionResearchService paperResearchService;
    private final ExecutionTelemetryRepository telemetryRepository;
    private final ExecutionTelemetryService telemetryService;
    private final ExecutionSafetyIntegrator executionSafetyIntegrator;
    private final IbkrReadinessGate readinessGate;
    private final VerifiedStreamRegistry verifiedStreamRegistry;
    private final LiveStreamProperties streamProperties;
    private final SubscriptionManagerService subscriptionManager;

    public LiveTraderDtos.OperationalMonitorDto monitor() {
        liveScannerService.ensureFresh(5_000);
        var scanner = liveScannerService.currentSnapshot();
        long age = System.currentTimeMillis() - scanner.generatedAt();
        var broker = brokerConnectionManager.status();

        List<String> safety = new ArrayList<>();
        if (!ibkrClientService.isConnected()) safety.add("IBKR disconnected");
        if (ibkrClientService.isConnected() && !ibkrClientService.isIbkrReady()) {
            safety.add("IBKR handshake incomplete");
        }
        if (ibkrClientService.isIbkrReady() && verifiedStreamRegistry.verifiedCount() == 0) {
            safety.add("No verified realtime ticks");
        }
        if (runtimeState.isKillSwitchActive()) safety.add("Kill switch active");
        if (age > 10_000 && runtimeState.isScanningEnabled()) safety.add("Scanner cache stale");

        DataIntegritySnapshot integrity = executionSafetyIntegrator.snapshot();
        if (!integrity.allowsExecution()) {
            safety.add("Execution frozen: data " + integrity.state());
        }

        long staleMs = streamProperties.getStaleSeconds() * 1000L;
        long deadMs = streamProperties.getDeadSeconds() * 1000L;
        int staleCount = verifiedStreamRegistry.staleSymbols(staleMs, deadMs).size();
        int deadCount = verifiedStreamRegistry.deadSymbols(deadMs).size();
        long lastTick = verifiedStreamRegistry.lastSuccessfulTickMs();
        String quoteFreshness = "OFFLINE";
        if (ibkrClientService.isConnected()) {
            if (lastTick > 0) {
                long tickAge = System.currentTimeMillis() - lastTick;
                quoteFreshness = tickAge < 15_000 ? "LIVE" : tickAge < 60_000 ? "DEGRADED" : "STALE";
            } else if (ibkrClientService.isIbkrReady()) {
                quoteFreshness = "WAITING_TICK";
            } else {
                quoteFreshness = "HANDSHAKE";
            }
        }

        return new LiveTraderDtos.OperationalMonitorDto(
                ibkrClientService.isConnected(),
                ibkrClientService.isIbkrReady(),
                ibkrClientService.isLiveStreaming(),
                quoteFreshness,
                runtimeState.isScanningEnabled(),
                runtimeState.isAutoExecutionEnabled(),
                runtimeState.isKillSwitchActive(),
                liveScannerService.generation(),
                age,
                (int) telemetryRepository.count(),
                paperResearchService.activeRecords().size(),
                runtimeState.getExecutionMode().name(),
                broker.latencyMs(),
                integrity.state().name(),
                integrity.score(),
                !integrity.allowsExecution(),
                telemetryService.recentLogs(8),
                safety,
                verifiedStreamRegistry.verifiedCount(),
                subscriptionManager.registrySubscriptionCount(),
                staleCount,
                deadCount,
                verifiedStreamRegistry.reconnectAttempts(),
                verifiedStreamRegistry.avgTickLatencyMs(),
                lastTick,
                verifiedStreamRegistry.streamHealthScore(),
                readinessGate.phase().name()
        );
    }
}
