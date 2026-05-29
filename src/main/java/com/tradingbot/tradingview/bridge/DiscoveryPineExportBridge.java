package com.tradingbot.tradingview.bridge;

import com.tradingbot.discovery.historical.DiscoveryDirection;
import com.tradingbot.discovery.historical.HistoricalBulkDiscoveryDtos;
import com.tradingbot.discovery.historical.HistoricalBulkDiscoveryService;
import com.tradingbot.tradingview.dto.PineDiscoveryExportDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Phase 217 — export autonomous discovery intelligence for Pine scripts. */
@Service
@RequiredArgsConstructor
public class DiscoveryPineExportBridge {

    private static final String DISCLAIMER =
            "Discovery export for Pine — advisory thresholds only; does not auto-execute.";

    private final HistoricalBulkDiscoveryService historicalBulkDiscoveryService;

    public PineDiscoveryExportDto bullish(int days) {
        return export(DiscoveryDirection.BULLISH, days);
    }

    public PineDiscoveryExportDto bearish(int days) {
        return export(DiscoveryDirection.BEARISH, days);
    }

    public PineDiscoveryExportDto putAssist(int days) {
        return export(DiscoveryDirection.BEARISH, days);
    }

    private PineDiscoveryExportDto export(DiscoveryDirection direction, int days) {
        HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto report =
                historicalBulkDiscoveryService.report(days, direction);
        Map<String, Object> thresholds = new LinkedHashMap<>();
        thresholds.put("dominanceRealtimeThreshold", 130);
        thresholds.put("persistenceStrongMin", 70);
        thresholds.put("convictionHighMin", 75);
        thresholds.put("rvolExpansionMin", 2.0);
        thresholds.put("bearishBiasPutAssistMin", 55);
        thresholds.put("continuationCaptureStrongPct", 55);

        if (!report.regimeFamilies().isEmpty()) {
            var top = report.regimeFamilies().get(0);
            thresholds.put("topFamilyWinRate", top.winRate());
            thresholds.put("topFamilyContinuationPct", top.continuationPct());
        }
        if (!report.putEntryQuality().isEmpty()) {
            var put = report.putEntryQuality().get(0);
            thresholds.put("topPutGrade", put.grade());
            thresholds.put("topPutFollowThroughPct", put.followThroughPct());
        }

        List<Map<String, Object>> families = report.regimeFamilies().stream()
                .limit(12)
                .map(f -> Map.<String, Object>of(
                        "family", f.family(),
                        "sampleCount", f.sampleCount(),
                        "winRate", f.winRate(),
                        "continuationPct", f.continuationPct(),
                        "memberRegimes", f.memberRegimes(),
                        "confidence", f.discoveryConfidenceScore()
                ))
                .toList();

        List<Map<String, Object>> continuationGates = report.continuationProfiles().stream()
                .limit(10)
                .map(c -> Map.<String, Object>of(
                        "profile", c.profile(),
                        "sampleCount", c.sampleCount(),
                        "persistenceSurvivalPct", c.persistenceSurvivalPct(),
                        "secondLegProbability", c.secondLegProbability(),
                        "exhaustionTimingScore", c.exhaustionTimingScore()
                ))
                .toList();

        List<Map<String, Object>> bearishStructures = new ArrayList<>();
        for (var b : report.breakdownProfiles()) {
            bearishStructures.add(Map.of(
                    "profile", b.profile(),
                    "sampleCount", b.sampleCount(),
                    "breakdownSurvivalPct", b.breakdownSurvivalPct(),
                    "failedBouncePct", b.failedBouncePct(),
                    "accelerationPct", b.accelerationPct()
            ));
        }
        for (var s : report.squeezeRisk()) {
            bearishStructures.add(Map.of(
                    "context", s.context(),
                    "squeezeRiskScore", s.squeezeRiskScore(),
                    "note", s.note()
            ));
        }

        List<Map<String, Object>> lifecycle = report.trendMaturity().stream()
                .limit(8)
                .map(t -> Map.<String, Object>of(
                        "maturity", t.maturity(),
                        "sampleCount", t.sampleCount(),
                        "continuationPct", t.continuationPct(),
                        "failurePct", t.failurePct()
                ))
                .toList();

        String label = direction == DiscoveryDirection.BULLISH ? "BULLISH" : "BEARISH_PUT";
        return new PineDiscoveryExportDto(
                label,
                report.meta().generatedAtMs(),
                report.meta().lookbackDays(),
                thresholds,
                families,
                continuationGates,
                bearishStructures,
                lifecycle,
                report.insights(),
                DISCLAIMER
        );
    }
}
