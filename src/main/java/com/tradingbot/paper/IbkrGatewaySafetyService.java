package com.tradingbot.paper;

import com.tradingbot.config.IBKRProperties;
import com.tradingbot.ibkr.IBKRClientService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class IbkrGatewaySafetyService {

    private final IBKRProperties ibkrProperties;
    private final IBKRClientService ibkrClientService;

    public IbkrGatewayMode resolveGatewayMode() {
        if (!ibkrClientService.isConnected()) {
            return IbkrGatewayMode.DISCONNECTED;
        }
        int port = ibkrProperties.getPort();
        if (port == ibkrProperties.getPaperPort() || port == ibkrProperties.getPaperGatewayPort()) {
            return IbkrGatewayMode.PAPER;
        }
        if (port == ibkrProperties.getLivePort() || port == ibkrProperties.getLiveGatewayPort()) {
            return IbkrGatewayMode.LIVE;
        }
        return IbkrGatewayMode.UNKNOWN;
    }

    /**
     * Hard safety: PAPER_RESEARCH requires paper gateway; live modes require live gateway.
     */
    public SafetyValidation validate(PaperExecutionMode mode) {
        IbkrGatewayMode gateway = resolveGatewayMode();
        if (gateway == IbkrGatewayMode.DISCONNECTED) {
            return SafetyValidation.blocked("IBKR gateway not connected");
        }
        if (mode == PaperExecutionMode.PAPER_RESEARCH && gateway == IbkrGatewayMode.LIVE) {
            return SafetyValidation.blocked(
                    "PAPER_RESEARCH blocked: live IBKR gateway detected on port "
                            + ibkrProperties.getPort() + " (expected paper port "
                            + ibkrProperties.getPaperPort() + ")");
        }
        if (mode.isLiveFamily() && gateway == IbkrGatewayMode.PAPER) {
            return SafetyValidation.blocked(
                    "Live execution modes disabled in Phase 181 — paper gateway on port "
                            + ibkrProperties.getPort());
        }
        if (mode == PaperExecutionMode.OFF) {
            return SafetyValidation.blocked("Execution mode OFF");
        }
        if (mode == PaperExecutionMode.PAPER_SELECTIVE
                || mode == PaperExecutionMode.LIVE_ASSISTED
                || mode == PaperExecutionMode.LIVE_AUTO) {
            return SafetyValidation.blocked(mode.name() + " not enabled in Phase 181");
        }
        if (mode == PaperExecutionMode.PAPER_RESEARCH && gateway != IbkrGatewayMode.PAPER) {
            return SafetyValidation.blocked(
                    "PAPER_RESEARCH requires paper gateway (port " + ibkrProperties.getPaperPort()
                            + "), configured port=" + ibkrProperties.getPort());
        }
        return SafetyValidation.ok(gateway);
    }

    public record SafetyValidation(boolean allowed, String reason, IbkrGatewayMode gateway) {
        static SafetyValidation ok(IbkrGatewayMode gateway) {
            return new SafetyValidation(true, null, gateway);
        }

        static SafetyValidation blocked(String reason) {
            return new SafetyValidation(false, reason, null);
        }
    }
}
