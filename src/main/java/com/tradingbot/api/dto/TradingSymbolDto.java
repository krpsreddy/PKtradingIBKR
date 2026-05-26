package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Value
@Builder(toBuilder = true)
public class TradingSymbolDto {
    String symbol;
    boolean enabled;
    boolean pinned;
    String groupName;
    boolean scanEnabled;
    boolean preloadOnStartup;
    boolean subscribeLive;
    int displayOrder;
    boolean active;
    LocalDateTime lastViewedAt;
    String sector;
    BigDecimal marketCap;
    String exchange;
    Long floatShares;
    Long avgDailyVolume;
    // Runtime enrichment (sidebar)
    Double price;
    String trend;
    String trendIcon;
    Double relativeVolume;
    String signalState;
    String lifecycleState;
    String momentumState;
    String readinessState;
    String openReadinessState;
    Double gapPercent;
    Integer confidenceScore;
    String confidenceLabel;
    boolean highRvol;
    boolean historicalLoaded;
    boolean liveSubscribed;
    List<Double> sparkline;
    String trend5m;
    String trend15m;
    String trend1h;
    String mtfSummary;
    Integer mtfAlignmentScore;
    boolean extended;
    String extendedState;
    String freshness;
    String freshnessLabel;
    Integer rankScore;
    boolean regimeAligned;
    List<String> optionsWarnings;
}
