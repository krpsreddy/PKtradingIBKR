package com.tradingbot.tradingview.dto;

import java.util.List;
import java.util.Map;

/** Phase 217 — discovery thresholds exported for Pine scripts. */
public record PineDiscoveryExportDto(
        String direction,
        long generatedAtMs,
        int lookbackDays,
        Map<String, Object> thresholds,
        List<Map<String, Object>> regimeFamilies,
        List<Map<String, Object>> continuationGates,
        List<Map<String, Object>> bearishStructures,
        List<Map<String, Object>> lifecycleIntelligence,
        List<String> insights,
        String disclaimer
) {}
