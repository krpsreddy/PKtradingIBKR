package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class BulkWatchlistImportResult {
    int requested;
    int unique;
    int added;
    int reEnabled;
    int alreadyOnWatchlist;
    int skipped;
    List<String> skippedSymbols;
}
