package com.tradingbot.discovery.historical;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/** Phase 204/206 — delegates to directional insight engines (legacy bean). */
@Component
@RequiredArgsConstructor
public class HistoricalDiscoveryInsightsEngine {

    private final BullishDiscoveryInsightsEngine bullish;

    public List<String> generate(HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto report) {
        return bullish.generate(report);
    }
}
