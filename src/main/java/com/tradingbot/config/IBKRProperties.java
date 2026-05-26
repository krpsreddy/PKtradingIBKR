package com.tradingbot.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "ibkr")
public class IBKRProperties {
    private String host = "127.0.0.1";
    private int port = 7497;
    private int clientId = 1;
    private String symbol = "NVDA";
    /** 1=live, 2=frozen, 3=delayed, 4=delayed frozen — use 3 without a live API subscription */
    private int marketDataType = 3;
}
