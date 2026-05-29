package com.tradingbot.livetrader;

import com.tradingbot.bearishassist.BearishAssistService;
import com.tradingbot.intelligence.live.BackgroundHydrationOrchestrator;
import com.tradingbot.intelligence.live.HydrationControlsDto;
import com.tradingbot.paper.PaperExecutionMode;
import com.tradingbot.runtime.RuntimeExecutionSafetyGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/** Phase 185/188 — in-memory runtime controls (operational app, not research UI). */
@Component
@RequiredArgsConstructor
public class LiveTraderRuntimeState {

    private final BackgroundHydrationOrchestrator hydrationOrchestrator;
    private final BearishAssistService bearishAssistService;
    private final RuntimeExecutionSafetyGuard runtimeSafetyGuard;

    private final AtomicBoolean scanningEnabled = new AtomicBoolean(true);
    private final AtomicBoolean telegramEnabled = new AtomicBoolean(false);
    private final AtomicBoolean autoExecutionEnabled = new AtomicBoolean(false);
    private final AtomicBoolean killSwitchActive = new AtomicBoolean(false);
    private final AtomicReference<PaperExecutionMode> executionMode =
            new AtomicReference<>(PaperExecutionMode.OFF);

    public boolean isScanningEnabled() {
        return scanningEnabled.get() && !killSwitchActive.get();
    }

    public boolean isTelegramEnabled() {
        return telegramEnabled.get();
    }

    public boolean isAutoExecutionEnabled() {
        return autoExecutionEnabled.get() && !killSwitchActive.get();
    }

    public boolean isKillSwitchActive() {
        return killSwitchActive.get();
    }

    public PaperExecutionMode getExecutionMode() {
        return executionMode.get();
    }

    public void apply(LiveTraderDtos.SetRuntimeControlsRequest req) {
        if (req == null) return;
        runtimeSafetyGuard.validateRuntimeControlUpdate(req.executionMode(), req.autoExecutionEnabled());
        if (req.scanningEnabled() != null) scanningEnabled.set(req.scanningEnabled());
        if (req.telegramEnabled() != null) telegramEnabled.set(req.telegramEnabled());
        if (req.autoExecutionEnabled() != null) {
            autoExecutionEnabled.set(runtimeSafetyGuard.coerceAutoExecutionEnabled(req.autoExecutionEnabled()));
        }
        if (req.executionMode() != null) {
            executionMode.set(runtimeSafetyGuard.coercePaperExecutionMode(req.executionMode()));
        }
        if (req.backgroundHydrationEnabled() != null) {
            hydrationOrchestrator.setEnabled(req.backgroundHydrationEnabled());
        }
        if (req.bearishAssistMode() != null) {
            bearishAssistService.setMode(req.bearishAssistMode());
        }
    }

    public void activateKillSwitch() {
        killSwitchActive.set(true);
        scanningEnabled.set(false);
        autoExecutionEnabled.set(false);
        executionMode.set(PaperExecutionMode.OFF);
    }

    public void resetKillSwitch() {
        killSwitchActive.set(false);
    }

    public LiveTraderDtos.RuntimeControlsDto snapshot() {
        HydrationControlsDto hydration = hydrationOrchestrator.controlsSnapshot();
        return new LiveTraderDtos.RuntimeControlsDto(
                scanningEnabled.get(),
                telegramEnabled.get(),
                autoExecutionEnabled.get(),
                executionMode.get(),
                bearishAssistService.getMode(),
                hydration.enabled(),
                hydration.pendingJobs(),
                killSwitchActive.get()
        );
    }
}
