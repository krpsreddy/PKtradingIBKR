package com.tradingbot.sessionintelligence;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Phase 211 — session-aware premarket intelligence toggles. */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "session.premarket")
public class PremarketIntelligenceProperties {

    private boolean enabled = true;
    private boolean telemetryEnabled = true;
}
