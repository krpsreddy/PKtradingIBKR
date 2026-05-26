package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder(toBuilder = true)
public class WatchlistItemDto {
    // Intelligence (options-aware intraday)
    String symbol;
    String source;
    boolean active;
    boolean pinned;
    boolean isDefault;
    boolean isCustom;
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
