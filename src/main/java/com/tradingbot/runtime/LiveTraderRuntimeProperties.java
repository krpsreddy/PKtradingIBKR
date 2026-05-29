package com.tradingbot.runtime;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "live-trader")
public class LiveTraderRuntimeProperties {

    private String executionMode = "AUTO_PAPER";

    private boolean autoPaperEnabled = false;

    private boolean liveExecutionEnabled = false;
}
