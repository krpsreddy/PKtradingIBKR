package com.tradingbot.analytics.query;

import com.tradingbot.analytics.query.dto.AnalyticsQueryDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Phase 156 — PostgreSQL analytics diagnostics (read-only). */
@RestController
@RequestMapping("/api/analytics-query")
@RequiredArgsConstructor
public class AnalyticsQueryController {

    private final AnalyticsDiagnosticsService queryService;

    @GetMapping("/conviction-distribution")
    public ConvictionDistributionDto convictionDistribution(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String decision,
            @RequestParam(required = false) String narrative,
            @RequestParam(required = false) String quality,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String convictionBand
    ) {
        return queryService.convictionDistribution(params(symbol, from, to, decision, narrative, quality, result, convictionBand));
    }

    @GetMapping("/decision-stats")
    public List<GroupStatDto> decisionStats(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String decision,
            @RequestParam(required = false) String narrative,
            @RequestParam(required = false) String quality,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String convictionBand
    ) {
        return queryService.decisionStats(params(symbol, from, to, decision, narrative, quality, result, convictionBand));
    }

    @GetMapping("/narrative-stats")
    public List<GroupStatDto> narrativeStats(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String decision,
            @RequestParam(required = false) String narrative,
            @RequestParam(required = false) String quality,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String convictionBand
    ) {
        return queryService.narrativeStats(params(symbol, from, to, decision, narrative, quality, result, convictionBand));
    }

    @GetMapping("/quality-stats")
    public List<GroupStatDto> qualityStats(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String decision,
            @RequestParam(required = false) String narrative,
            @RequestParam(required = false) String quality,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String convictionBand
    ) {
        return queryService.qualityStats(params(symbol, from, to, decision, narrative, quality, result, convictionBand));
    }

    @GetMapping("/result-stats")
    public List<GroupStatDto> resultStats(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String decision,
            @RequestParam(required = false) String narrative,
            @RequestParam(required = false) String quality,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String convictionBand
    ) {
        return queryService.resultStats(params(symbol, from, to, decision, narrative, quality, result, convictionBand));
    }

    @GetMapping("/cross-matrix")
    public CrossMatrixDto crossMatrix(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String decision,
            @RequestParam(required = false) String narrative,
            @RequestParam(required = false) String quality,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String convictionBand
    ) {
        return queryService.crossMatrix(params(symbol, from, to, decision, narrative, quality, result, convictionBand));
    }

    @GetMapping("/diagnostics")
    public DiagnosticsSummaryDto diagnostics(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String decision,
            @RequestParam(required = false) String narrative,
            @RequestParam(required = false) String quality,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String convictionBand
    ) {
        return queryService.diagnostics(params(symbol, from, to, decision, narrative, quality, result, convictionBand));
    }

    @GetMapping("/workbench")
    public AnalyticsWorkbenchDto workbench(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String decision,
            @RequestParam(required = false) String narrative,
            @RequestParam(required = false) String quality,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String convictionBand
    ) {
        return queryService.workbench(params(symbol, from, to, decision, narrative, quality, result, convictionBand));
    }

    @GetMapping("/db-count")
    public java.util.Map<String, Long> dbCount() {
        return java.util.Map.of("evaluatedSnapshots", queryService.totalSnapshotsInDb());
    }

    private AnalyticsDiagnosticsService.AnalyticsQueryParams params(
            String symbol, String from, String to,
            String decision, String narrative, String quality, String result, String convictionBand
    ) {
        return AnalyticsDiagnosticsService.AnalyticsQueryParams.parse(
                symbol, from, to, decision, narrative, quality, result, convictionBand);
    }
}
