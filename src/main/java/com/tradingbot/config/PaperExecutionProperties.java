package com.tradingbot.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.LinkedHashSet;
import java.util.Set;

@Data
@ConfigurationProperties(prefix = "paper-execution")
public class PaperExecutionProperties {
    private boolean researchEnabled = false;
    private int fixedQuantity = 1;
    private String orderType = "MKT";
    private int dedupeMinutes = 30;

    /** Phase 210 — adaptive limit + fill simulation (no IBKR placement when simulated-only). */
    private boolean intelligenceEnabled = false;
    private boolean simulatedFillsOnly = false;

    private Set<String> qualifiedRegimes = new LinkedHashSet<>(Set.of(
            "EARLY_EXPANSION",
            "INSTITUTIONAL_PERSISTENCE",
            "SHALLOW_PULLBACK_CONTINUATION",
            "VWAP_ACCEPTANCE",
            "COMPRESSION_BREAKOUT",
            "HEALTHY_EXTENSION",
            "PERSISTENT_CONTINUATION"
    ));

    private Set<String> blockedRegimes = new LinkedHashSet<>(Set.of(
            "EXHAUSTION_DRIFT",
            "FAILED_EXPANSION",
            "DEGRADING"
    ));
}
