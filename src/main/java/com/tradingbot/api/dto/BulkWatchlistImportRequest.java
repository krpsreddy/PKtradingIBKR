package com.tradingbot.api.dto;

import lombok.Data;

import java.util.List;

@Data
public class BulkWatchlistImportRequest {
    private List<String> symbols;
    private String groupName;
    private Boolean scanEnabled;
    private Boolean subscribeLive;
    private Boolean preloadOnStartup;
}
