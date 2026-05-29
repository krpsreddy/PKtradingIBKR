package com.tradingbot.runtime;

import com.tradingbot.config.IBKRProperties;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@Getter
public class RuntimeProfileService {

    private final RuntimeType runtimeType;
    private final RuntimeExecutionMode executionMode;
    private final IntegrityMode integrityMode;
    private final BrokerType brokerType;
    private final int serverPort;
    private final int ibkrPort;
    private final boolean autoPaperEnabled;
    private final boolean liveExecutionEnabled;

    public RuntimeProfileService(
            RuntimeProfileProperties runtimeProps,
            LiveTraderRuntimeProperties liveTraderProps,
            IBKRProperties ibkrProperties,
            @Value("${server.port:8080}") int serverPort
    ) {
        this.runtimeType = parseRuntime(runtimeProps.getProfile());
        this.executionMode = parseExecutionMode(liveTraderProps.getExecutionMode());
        this.integrityMode = parseIntegrity(runtimeProps.getIntegrityMode());
        this.brokerType = runtimeType == RuntimeType.LIVE ? BrokerType.LIVE_GATEWAY : BrokerType.PAPER_GATEWAY;
        this.serverPort = serverPort;
        this.ibkrPort = ibkrProperties.getPort();
        this.autoPaperEnabled = liveTraderProps.isAutoPaperEnabled();
        this.liveExecutionEnabled = liveTraderProps.isLiveExecutionEnabled();
    }

    public boolean isPaperRuntime() {
        return runtimeType == RuntimeType.PAPER;
    }

    public boolean isLiveRuntime() {
        return runtimeType == RuntimeType.LIVE;
    }

    public boolean allowsAutoPaper() {
        return isPaperRuntime() && autoPaperEnabled && executionMode == RuntimeExecutionMode.AUTO_PAPER;
    }

    public boolean isDelayedDataTolerant() {
        return integrityMode == IntegrityMode.DELAYED_TOLERANT;
    }

    public RuntimeProfileDto snapshot() {
        return new RuntimeProfileDto(
                runtimeType.name(),
                executionMode.name(),
                serverPort,
                ibkrPort,
                integrityMode.name(),
                brokerType.name(),
                autoPaperEnabled,
                liveExecutionEnabled
        );
    }

    private static RuntimeType parseRuntime(String raw) {
        if (raw == null) {
            return RuntimeType.PAPER;
        }
        return switch (raw.trim().toUpperCase()) {
            case "LIVE" -> RuntimeType.LIVE;
            default -> RuntimeType.PAPER;
        };
    }

    private static RuntimeExecutionMode parseExecutionMode(String raw) {
        if (raw == null) {
            return RuntimeExecutionMode.AUTO_PAPER;
        }
        return switch (raw.trim().toUpperCase()) {
            case "MANUAL_ASSIST" -> RuntimeExecutionMode.MANUAL_ASSIST;
            default -> RuntimeExecutionMode.AUTO_PAPER;
        };
    }

    private static IntegrityMode parseIntegrity(String raw) {
        if (raw == null) {
            return IntegrityMode.STRICT;
        }
        return switch (raw.trim().toUpperCase()) {
            case "DELAYED_TOLERANT" -> IntegrityMode.DELAYED_TOLERANT;
            default -> IntegrityMode.STRICT;
        };
    }
}
