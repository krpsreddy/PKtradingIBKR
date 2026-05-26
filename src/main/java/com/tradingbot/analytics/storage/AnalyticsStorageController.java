package com.tradingbot.analytics.storage;

import com.fasterxml.jackson.databind.JsonNode;
import com.tradingbot.analytics.storage.dto.AnalyticsStorageDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Phase 147 — persistent analytics storage API (advisory only). */
@RestController
@RequestMapping("/api/analytics-storage")
@RequiredArgsConstructor
public class AnalyticsStorageController {

    private final AnalyticsPersistenceService persistenceService;
    private final AnalyticsQueryService queryService;
    private final HistoricalSignalSearchService signalSearchService;
    private final AnalyticsVersionService versionService;

    @GetMapping("/version")
    public AnalyticsVersionDto version() {
        return queryService.versionInfo();
    }

    @GetMapping("/stats")
    public StorageStatsDto stats() {
        return queryService.stats();
    }

    @GetMapping("/snapshots")
    public EvaluatedSnapshotPageDto snapshots(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) Long fromTs,
            @RequestParam(required = false) Long toTs,
            @RequestParam(required = false) String setup,
            @RequestParam(required = false) String regime,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "500") int size
    ) {
        return queryService.fetchSnapshots(symbol, fromTs, toTs, setup, regime, page, size);
    }

    @GetMapping("/signals/search")
    public HistoricalSignalSearchPageDto searchSignals(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String decision,
            @RequestParam(required = false) String narrative,
            @RequestParam(required = false) String quality,
            @RequestParam(required = false) String result,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "500") int size
    ) {
        java.time.LocalDate fromDate = from != null && !from.isBlank() ? java.time.LocalDate.parse(from) : null;
        java.time.LocalDate toDate = to != null && !to.isBlank() ? java.time.LocalDate.parse(to) : null;
        return signalSearchService.search(symbol, fromDate, toDate, decision, narrative, quality, result, page, size);
    }

    @PostMapping("/snapshots/bulk")
    public BulkUpsertResultDto bulkUpsertSnapshots(@RequestBody BulkSnapshotRequest request) {
        if (request == null || request.signals() == null) {
            return new BulkUpsertResultDto(0, 0, versionService.currentVersion());
        }
        return persistenceService.bulkUpsertSnapshots(request.signals(), request.analyticsVersion());
    }

    @GetMapping("/hydration")
    public List<HydrationSessionDto> allHydration() {
        return queryService.fetchAllHydration();
    }

    @GetMapping("/hydration/{symbol}")
    public HydrationSessionDto hydration(@PathVariable String symbol) {
        return queryService.fetchHydration(symbol);
    }

    @PutMapping("/hydration/{symbol}")
    public HydrationSessionDto upsertHydration(
            @PathVariable String symbol,
            @RequestBody HydrationSessionDto dto
    ) {
        HydrationSessionDto merged = new HydrationSessionDto(
                symbol.toUpperCase(),
                dto.lookbackDays(),
                dto.candlesLoaded(),
                dto.signalsEvaluated(),
                dto.status(),
                dto.evaluatedSessionDates(),
                versionService.currentVersion(),
                dto.startedAt(),
                dto.completedAt(),
                false
        );
        return persistenceService.upsertHydration(merged);
    }

    @GetMapping("/playbook-candidates")
    public List<JsonNode> playbookCandidates() {
        return queryService.fetchPlaybookCandidates();
    }

    @PostMapping("/playbook-candidates/bulk")
    public Map<String, Integer> bulkUpsertPlaybooks(@RequestBody List<PlaybookCandidatePersistDto> candidates) {
        return Map.of("upserted", persistenceService.bulkUpsertPlaybookCandidates(candidates));
    }

    @PostMapping("/decision-feedback/bulk")
    public Map<String, Integer> bulkUpsertFeedback(@RequestBody List<DecisionFeedbackPersistDto> rows) {
        return Map.of("upserted", persistenceService.bulkUpsertDecisionFeedback(rows));
    }
}
