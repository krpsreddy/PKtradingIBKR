package com.tradingbot.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "ibkr")
public class IBKRProperties {
    private String host = "127.0.0.1";
    private int port = 7497;
    private int clientId = 1;
    /** When true, adds (pid % 50) to base client id so multiple local JVMs do not collide on Gateway. */
    private boolean clientIdAutoOffset = false;
    private String symbol = "NVDA";
    /** 1=live, 2=frozen, 3=delayed, 4=delayed frozen — use 3 without a live API subscription */
    private int marketDataType = 3;
    /** TWS paper API port. */
    private int paperPort = 7497;
    /** TWS live API port. */
    private int livePort = 7496;
    /** IB Gateway paper (simulated) API port. */
    private int paperGatewayPort = 4002;
    /** IB Gateway live API port. */
    private int liveGatewayPort = 4001;
    /**
     * Max concurrent {@code reqMktData} streams. Paper allows ~100 lines; without full data
     * bundles the effective cap is often lower.
     */
    private int maxLiveStreams = 40;
}
