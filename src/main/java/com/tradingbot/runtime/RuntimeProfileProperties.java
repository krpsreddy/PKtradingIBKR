package com.tradingbot.runtime;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "runtime")
public class RuntimeProfileProperties {

    /** PAPER | LIVE */
    private String profile = "PAPER";

    private String executionMode = "AUTO_PAPER";

    private String integrityMode = "DELAYED_TOLERANT";
}
