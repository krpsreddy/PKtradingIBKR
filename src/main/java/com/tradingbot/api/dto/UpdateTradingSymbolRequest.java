package com.tradingbot.api.dto;

import lombok.Data;

@Data
public class UpdateTradingSymbolRequest {
    private String groupName;
    private Boolean enabled;
    private Boolean pinned;
    private Boolean scanEnabled;
    private Boolean subscribeLive;
    private Boolean preloadOnStartup;
    private Integer displayOrder;
}
