package com.tradingbot.tradingview;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Phase 217 — TradingView webhook bridge configuration. */
@Data
@ConfigurationProperties(prefix = "tradingview")
public class TradingViewProperties {

    /** Auto-expire signals with no refresh after this many minutes. */
    private int staleMinutes = 15;

    /** Dedupe window for identical alert fingerprints (seconds). */
    private int throttleSeconds = 60;

    private int maxStoredSignals = 500;

    /** Optional shared secret (header X-TV-Token). Empty = accept all. */
    private String webhookSecret = "";

    private int topListSize = 12;
}
