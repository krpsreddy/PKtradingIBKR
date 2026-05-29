package com.tradingbot.intelligence.live;

import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

/** Phase 187 — runtime toggle for background historical hydration. */
@Component
public class BackgroundHydrationRuntimeState {

    private final AtomicBoolean enabled = new AtomicBoolean(true);

    public boolean isEnabled() {
        return enabled.get();
    }

    public void setEnabled(boolean value) {
        enabled.set(value);
    }
}
