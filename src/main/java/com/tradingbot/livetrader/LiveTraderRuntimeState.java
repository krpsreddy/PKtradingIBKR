package com.tradingbot.livetrader;

import com.tradingbot.paper.PaperExecutionMode;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/** Phase 185 — in-memory runtime controls (operational app, not research UI). */
@Component
public class LiveTraderRuntimeState {

    private final AtomicBoolean scanningEnabled = new AtomicBoolean(true);
    private final AtomicBoolean telegramEnabled = new AtomicBoolean(false);
    private final AtomicBoolean autoExecutionEnabled = new AtomicBoolean(false);
    private final AtomicReference<PaperExecutionMode> executionMode =
            new AtomicReference<>(PaperExecutionMode.OFF);

    public boolean isScanningEnabled() {
        return scanningEnabled.get();
    }

    public boolean isTelegramEnabled() {
        return telegramEnabled.get();
    }

    public boolean isAutoExecutionEnabled() {
        return autoExecutionEnabled.get();
    }

    public PaperExecutionMode getExecutionMode() {
        return executionMode.get();
    }

    public void apply(LiveTraderDtos.SetRuntimeControlsRequest req) {
        if (req == null) return;
        if (req.scanningEnabled() != null) scanningEnabled.set(req.scanningEnabled());
        if (req.telegramEnabled() != null) telegramEnabled.set(req.telegramEnabled());
        if (req.autoExecutionEnabled() != null) autoExecutionEnabled.set(req.autoExecutionEnabled());
        if (req.executionMode() != null) executionMode.set(req.executionMode());
    }

    public LiveTraderDtos.RuntimeControlsDto snapshot() {
        return new LiveTraderDtos.RuntimeControlsDto(
                scanningEnabled.get(),
                telegramEnabled.get(),
                autoExecutionEnabled.get(),
                executionMode.get()
        );
    }
}
