package com.tradingbot.analytics.query;

import com.tradingbot.analytics.query.dto.AnalyticsQueryDtos.*;
import com.tradingbot.analytics.query.model.AnalyticsSignalRow;
import com.tradingbot.analytics.storage.AnalyticsVersionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/** Phase 156 — observability analytics query orchestrator. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnalyticsDiagnosticsService {

    private final AnalyticsQueryRepository repository;
    private final AnalyticsDistributionEngine distributionEngine;
    private final AnalyticsSummaryEngine summaryEngine;
    private final AnalyticsCrossMatrixEngine crossMatrixEngine;
    private final AnalyticsVersionService versionService;

    public ConvictionDistributionDto convictionDistribution(AnalyticsQueryParams params) {
        return distributionEngine.distribution(load(params));
    }

    public List<GroupStatDto> decisionStats(AnalyticsQueryParams params) {
        return summaryEngine.decisionStats(load(params));
    }

    public List<GroupStatDto> narrativeStats(AnalyticsQueryParams params) {
        return summaryEngine.narrativeStats(load(params));
    }

    public List<GroupStatDto> qualityStats(AnalyticsQueryParams params) {
        return summaryEngine.qualityStats(load(params));
    }

    public List<GroupStatDto> resultStats(AnalyticsQueryParams params) {
        return summaryEngine.resultStats(load(params));
    }

    public CrossMatrixDto crossMatrix(AnalyticsQueryParams params) {
        return crossMatrixEngine.build(load(params));
    }

    public DiagnosticsSummaryDto diagnostics(AnalyticsQueryParams params) {
        return summaryEngine.diagnostics(load(params), versionService.currentVersion());
    }

    public AnalyticsWorkbenchDto workbench(AnalyticsQueryParams params) {
        List<AnalyticsSignalRow> rows = load(params);
        return new AnalyticsWorkbenchDto(
                distributionEngine.distribution(rows),
                summaryEngine.decisionStats(rows),
                summaryEngine.narrativeStats(rows),
                summaryEngine.qualityStats(rows),
                summaryEngine.resultStats(rows),
                crossMatrixEngine.build(rows),
                summaryEngine.diagnostics(rows, versionService.currentVersion()),
                rows.size(),
                System.currentTimeMillis()
        );
    }

    public long totalSnapshotsInDb() {
        return repository.countAll();
    }

    private List<AnalyticsSignalRow> load(AnalyticsQueryParams params) {
        return repository.loadRows(AnalyticsQueryRepository.AnalyticsQueryFilter.from(
                params.symbol(),
                params.from(),
                params.to(),
                params.decision(),
                params.narrative(),
                params.quality(),
                params.result(),
                params.convictionBand()
        ));
    }

    public record AnalyticsQueryParams(
            String symbol,
            LocalDate from,
            LocalDate to,
            String decision,
            String narrative,
            String quality,
            String result,
            String convictionBand
    ) {
        public static AnalyticsQueryParams parse(
                String symbol, String from, String to,
                String decision, String narrative, String quality, String result, String convictionBand
        ) {
            LocalDate fromDate = from != null && !from.isBlank() ? LocalDate.parse(from) : null;
            LocalDate toDate = to != null && !to.isBlank() ? LocalDate.parse(to) : null;
            return new AnalyticsQueryParams(symbol, fromDate, toDate, decision, narrative, quality, result, convictionBand);
        }
    }
}
