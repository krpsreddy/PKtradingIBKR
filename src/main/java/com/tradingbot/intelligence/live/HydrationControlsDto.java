package com.tradingbot.intelligence.live;

/** API shape for background hydration controls. */
public record HydrationControlsDto(
        boolean enabled,
        int pendingJobs
) {}
