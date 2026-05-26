package com.tradingbot.api.dto;

import lombok.Data;

@Data
public class CreateTradingSymbolRequest {
    private String symbol;
    private String groupName;
    private Boolean scanEnabled;
    private Boolean subscribeLive;
    private Boolean preloadOnStartup;
    private Boolean enabled;
    private Boolean pinned;
}
