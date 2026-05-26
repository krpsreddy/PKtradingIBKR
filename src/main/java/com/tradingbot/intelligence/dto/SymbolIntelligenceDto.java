package com.tradingbot.intelligence.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SymbolIntelligenceDto {
    String symbol;
    MultiTimeframeDto mtf;
    ExtendedStateDto extended;
    SignalFreshnessDto freshness;
    SignalRankDto rank;
    boolean regimeAligned;
    String regimeImpact;
    ExecutionIntelligenceDto execution;
}
