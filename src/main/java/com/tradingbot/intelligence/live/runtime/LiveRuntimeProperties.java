package com.tradingbot.intelligence.live.runtime;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Phase 191 — live trader runtime (streaming) vs research hydration. */
@Component
@ConfigurationProperties(prefix = "live-runtime")
@Getter
@Setter
public class LiveRuntimeProperties {

    /** Research/async hydration (Edge Lab). Off by default in evolution. */
    private boolean researchHydrationEnabled = false;

    /** One-time lightweight candle bootstrap per symbol/session. */
    private boolean bootstrapEnabled = true;

    /** Optional reconnect / periodic structure refresh (minutes). 0 = disabled. */
    private int bootstrapRefreshMinutes = 45;
}
