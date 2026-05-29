package com.tradingbot.runtime;

import com.tradingbot.paper.PaperExecutionMode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Phase 221 — hard block auto paper / auto execution on LIVE runtime (even if misconfigured).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RuntimeExecutionSafetyGuard {

    private final RuntimeProfileService runtimeProfile;

    public void enforceOnStartup() {
        if (!runtimeProfile.isLiveRuntime()) {
            return;
        }
        if (runtimeProfile.isAutoPaperEnabled()) {
            log.error("[RUNTIME] LIVE runtime misconfigured with auto-paper — forcing disabled");
        }
        if (runtimeProfile.getExecutionMode() == RuntimeExecutionMode.AUTO_PAPER) {
            log.error("[RUNTIME] LIVE runtime misconfigured with AUTO_PAPER — forcing MANUAL_ASSIST");
        }
        if (runtimeProfile.isLiveExecutionEnabled()) {
            log.error("[RUNTIME] LIVE runtime misconfigured with live-execution — forcing disabled");
        }
    }

    public void validateRuntimeControlUpdate(PaperExecutionMode requestedMode, Boolean autoExecution) {
        if (!runtimeProfile.isLiveRuntime()) {
            return;
        }
        if (autoExecution != null && autoExecution) {
            throw new IllegalStateException("Auto execution is blocked on LIVE runtime (manual assist only)");
        }
        if (requestedMode != null && requestedMode.allowsAutomatedEntry()) {
            throw new IllegalStateException(requestedMode + " is blocked on LIVE runtime");
        }
    }

    public boolean coerceAutoExecutionEnabled(boolean requested) {
        if (runtimeProfile.isLiveRuntime()) {
            return false;
        }
        return requested && runtimeProfile.allowsAutoPaper();
    }

    public PaperExecutionMode coercePaperExecutionMode(PaperExecutionMode requested) {
        if (requested == null) {
            return PaperExecutionMode.OFF;
        }
        if (runtimeProfile.isLiveRuntime()) {
            return PaperExecutionMode.OFF;
        }
        if (runtimeProfile.allowsAutoPaper()) {
            return requested.allowsAutomatedEntry() ? PaperExecutionMode.PAPER_RESEARCH : requested;
        }
        return requested;
    }
}
