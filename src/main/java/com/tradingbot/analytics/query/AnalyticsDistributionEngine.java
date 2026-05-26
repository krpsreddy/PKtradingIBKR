package com.tradingbot.analytics.query;

import com.tradingbot.analytics.query.dto.AnalyticsQueryDtos.BandMetricsDto;
import com.tradingbot.analytics.query.dto.AnalyticsQueryDtos.ConvictionDistributionDto;
import com.tradingbot.analytics.query.model.AnalyticsSignalRow;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Conviction band distribution (ELITE 90–100, HIGH 75–89, etc.). */
@Component
public class AnalyticsDistributionEngine {

    public ConvictionDistributionDto distribution(List<AnalyticsSignalRow> rows) {
        Map<String, List<AnalyticsSignalRow>> byBand = rows.stream()
                .collect(Collectors.groupingBy(AnalyticsSignalRow::convictionBand));

        return new ConvictionDistributionDto(
                bandMetrics(byBand.get("ELITE")),
                bandMetrics(byBand.get("HIGH")),
                bandMetrics(byBand.get("MODERATE")),
                bandMetrics(byBand.get("LOW")),
                bandMetrics(byBand.get("AVOID")),
                rows.size(),
                10
        );
    }

    public int[] histogram(List<AnalyticsSignalRow> rows, int buckets) {
        int[] hist = new int[buckets];
        for (AnalyticsSignalRow row : rows) {
            int idx = Math.min(buckets - 1, Math.max(0, row.conviction() * buckets / 100));
            hist[idx]++;
        }
        return hist;
    }

    private BandMetricsDto bandMetrics(List<AnalyticsSignalRow> rows) {
        if (rows == null || rows.isEmpty()) {
            return emptyBand();
        }
        int count = rows.size();
        double avgR = rows.stream().mapToDouble(AnalyticsSignalRow::resultR).average().orElse(0);
        double winRate = rows.stream().filter(AnalyticsSignalRow::winner).count() * 100.0 / count;
        double fakeout = rows.stream().filter(AnalyticsSignalRow::fakeout).count() * 100.0 / count;
        double continuation = rows.stream().mapToDouble(AnalyticsSignalRow::continuationPercent).average().orElse(0);
        double avgConviction = rows.stream().mapToInt(AnalyticsSignalRow::conviction).average().orElse(0);
        return new BandMetricsDto(count, round2(avgR), round2(winRate), round2(fakeout), round2(continuation), round2(avgConviction));
    }

    private BandMetricsDto emptyBand() {
        return new BandMetricsDto(0, 0, 0, 0, 0, 0);
    }

    static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
