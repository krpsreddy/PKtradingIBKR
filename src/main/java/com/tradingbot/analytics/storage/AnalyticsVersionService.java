package com.tradingbot.analytics.storage;

import org.springframework.stereotype.Service;

/** Tracks analytics schema version — bump when evaluation engines materially change. */
@Service
public class AnalyticsVersionService {

    /** Current canonical analytics version for persisted intelligence. */
    public static final int CURRENT_VERSION = 1;

    public int currentVersion() {
        return CURRENT_VERSION;
    }

    public boolean isCompatible(Integer version) {
        return version != null && version == CURRENT_VERSION;
    }

    public boolean requiresRehydration(Integer version) {
        return version == null || version != CURRENT_VERSION;
    }
}
