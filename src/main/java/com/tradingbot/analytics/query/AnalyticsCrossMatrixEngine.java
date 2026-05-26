package com.tradingbot.analytics.query;

import com.tradingbot.analytics.query.dto.AnalyticsQueryDtos.CrossMatrixCellDto;
import com.tradingbot.analytics.query.dto.AnalyticsQueryDtos.CrossMatrixDto;
import com.tradingbot.analytics.query.model.AnalyticsSignalRow;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Decision × narrative cross-matrix analytics. */
@Component
public class AnalyticsCrossMatrixEngine {

    public CrossMatrixDto build(List<AnalyticsSignalRow> rows) {
        Map<String, List<AnalyticsSignalRow>> groups = rows.stream()
                .collect(Collectors.groupingBy(r -> r.decision() + "||" + r.narrative()));

        List<CrossMatrixCellDto> cells = new ArrayList<>();
        for (Map.Entry<String, List<AnalyticsSignalRow>> entry : groups.entrySet()) {
            String[] parts = entry.getKey().split("\\|\\|", 2);
            String decision = parts[0];
            String narrative = parts.length > 1 ? parts[1] : "UNKNOWN";
            cells.add(cell(decision, narrative, entry.getValue()));
        }

        cells.sort(Comparator.comparingInt(CrossMatrixCellDto::count).reversed());
        return new CrossMatrixDto(cells, rows.size());
    }

    private CrossMatrixCellDto cell(String decision, String narrative, List<AnalyticsSignalRow> group) {
        int count = group.size();
        double avgR = group.stream().mapToDouble(AnalyticsSignalRow::resultR).average().orElse(0);
        double winRate = group.stream().filter(AnalyticsSignalRow::winner).count() * 100.0 / count;
        double fakeout = group.stream().filter(AnalyticsSignalRow::fakeout).count() * 100.0 / count;
        double continuation = group.stream().mapToDouble(AnalyticsSignalRow::continuationPercent).average().orElse(0);
        double avgConviction = group.stream().mapToInt(AnalyticsSignalRow::conviction).average().orElse(0);
        return new CrossMatrixCellDto(
                decision,
                narrative,
                count,
                AnalyticsDistributionEngine.round2(avgR),
                AnalyticsDistributionEngine.round2(winRate),
                AnalyticsDistributionEngine.round2(fakeout),
                AnalyticsDistributionEngine.round2(continuation),
                AnalyticsDistributionEngine.round2(avgConviction)
        );
    }
}
