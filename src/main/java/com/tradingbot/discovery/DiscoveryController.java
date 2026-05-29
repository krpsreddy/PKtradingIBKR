package com.tradingbot.discovery;

import com.tradingbot.discovery.historical.HistoricalBulkDiscoveryDtos;
import com.tradingbot.discovery.historical.HistoricalBulkDiscoveryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Phase 203 — empirical regime intelligence (read-only, cached). */
@RestController
@RequestMapping("/api/discovery")
@RequiredArgsConstructor
public class DiscoveryController {

    private final RegimeIntelligenceDiscoveryService discoveryService;
    private final HistoricalBulkDiscoveryService historicalBulkDiscoveryService;

    /** Phase 204 — historical bulk discovery (evaluated_signal_snapshots). */
    @GetMapping("/historical-bulk")
    public HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto historicalBulk(
            @RequestParam(defaultValue = "60") int days
    ) {
        return historicalBulkDiscoveryService.report(days);
    }

    /** Phase 206 — bullish continuation discovery only. */
    @GetMapping("/historical-bulk/bullish")
    public HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto historicalBullish(
            @RequestParam(defaultValue = "60") int days
    ) {
        return historicalBulkDiscoveryService.report(days, com.tradingbot.discovery.historical.DiscoveryDirection.BULLISH);
    }

    /** Phase 206 — bearish breakdown / PUT assist discovery only. */
    @GetMapping("/historical-bulk/bearish")
    public HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto historicalBearish(
            @RequestParam(defaultValue = "60") int days
    ) {
        return historicalBulkDiscoveryService.report(days, com.tradingbot.discovery.historical.DiscoveryDirection.BEARISH);
    }

    @PostMapping("/historical-bulk/refresh")
    public HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto refreshHistoricalBulk(
            @RequestParam(defaultValue = "60") int days
    ) {
        historicalBulkDiscoveryService.evictCache();
        return historicalBulkDiscoveryService.report(days);
    }

    @PostMapping("/historical-bulk/bullish/refresh")
    public HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto refreshHistoricalBullish(
            @RequestParam(defaultValue = "60") int days
    ) {
        historicalBulkDiscoveryService.evictCache();
        return historicalBulkDiscoveryService.report(days, com.tradingbot.discovery.historical.DiscoveryDirection.BULLISH);
    }

    @PostMapping("/historical-bulk/bearish/refresh")
    public HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto refreshHistoricalBearish(
            @RequestParam(defaultValue = "60") int days
    ) {
        historicalBulkDiscoveryService.evictCache();
        return historicalBulkDiscoveryService.report(days, com.tradingbot.discovery.historical.DiscoveryDirection.BEARISH);
    }

    @GetMapping("/regime-intelligence")
    public DiscoveryDtos.RegimeIntelligenceReportDto fullReport(
            @RequestParam(defaultValue = "60") int days
    ) {
        return discoveryService.report(days);
    }

    @GetMapping("/regime-performance")
    public List<DiscoveryDtos.RegimePerformanceRowDto> regimePerformance(
            @RequestParam(defaultValue = "60") int days
    ) {
        return discoveryService.regimePerformance(days);
    }

    @GetMapping("/market-structure-fit")
    public List<DiscoveryDtos.StructureFitCellDto> marketStructureFit(
            @RequestParam(defaultValue = "60") int days
    ) {
        return discoveryService.marketStructureFit(days);
    }

    @GetMapping("/entry-quality")
    public List<DiscoveryDtos.EntryQualityRowDto> entryQuality(
            @RequestParam(defaultValue = "60") int days
    ) {
        return discoveryService.entryQuality(days);
    }

    @GetMapping("/exit-quality")
    public List<DiscoveryDtos.ExitQualityRowDto> exitQuality(
            @RequestParam(defaultValue = "60") int days
    ) {
        return discoveryService.exitQuality(days);
    }

    @GetMapping("/continuation-capture")
    public List<DiscoveryDtos.ContinuationCaptureRowDto> continuationCapture(
            @RequestParam(defaultValue = "60") int days
    ) {
        return discoveryService.continuationCapture(days);
    }

    @GetMapping("/session-analysis")
    public List<DiscoveryDtos.SessionRowDto> sessionAnalysis(
            @RequestParam(defaultValue = "60") int days
    ) {
        return discoveryService.sessionAnalysis(days);
    }

    @GetMapping("/sector-analysis")
    public List<DiscoveryDtos.SectorRowDto> sectorAnalysis(
            @RequestParam(defaultValue = "60") int days
    ) {
        return discoveryService.sectorAnalysis(days);
    }

    @GetMapping("/bearish-analysis")
    public List<DiscoveryDtos.BearishAssistRowDto> bearishAnalysis(
            @RequestParam(defaultValue = "60") int days
    ) {
        return discoveryService.bearishAnalysis(days);
    }

    @GetMapping("/failure-clusters")
    public List<DiscoveryDtos.FailureClusterDto> failureClusters(
            @RequestParam(defaultValue = "60") int days
    ) {
        return discoveryService.failureClusters(days);
    }

    @GetMapping("/decision-trace-analysis")
    public List<DiscoveryDtos.DecisionTraceInsightDto> decisionTraceAnalysis(
            @RequestParam(defaultValue = "60") int days
    ) {
        return discoveryService.decisionTraceAnalysis(days);
    }
}
