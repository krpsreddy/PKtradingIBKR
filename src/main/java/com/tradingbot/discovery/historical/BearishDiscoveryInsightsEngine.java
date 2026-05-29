package com.tradingbot.discovery.historical;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Phase 206 — bearish breakdown / PUT assist insights. */
@Component
public class BearishDiscoveryInsightsEngine {

    public List<String> generate(HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto report) {
        List<String> out = new ArrayList<>();
        if (report.meta().sampleCount() < 10) {
            out.add("Insufficient bearish history — enable PUT assist telemetry and hydrate snapshots.");
            return out;
        }

        report.regimeFamilies().stream()
                .filter(f -> f.family().contains("FAILED_RECLAIM"))
                .findFirst()
                .ifPresent(f -> report.marketStructure().stream()
                        .filter(m -> m.structure().contains("FAILED_BREAKOUT"))
                        .findFirst()
                        .ifPresent(m -> out.add("FAILED_RECLAIM strongest during " + m.structure()
                                + " (n=" + f.sampleCount() + ").")));

        report.squeezeRisk().stream()
                .filter(s -> s.squeezeRiskScore() >= 60)
                .findFirst()
                .ifPresent(s -> out.add(s.context() + " shows elevated squeeze risk (score "
                        + s.squeezeRiskScore() + ") — caution on breakdown chase."));

        report.sessionBehavior().stream()
                .filter(s -> s.session().contains("MIDDAY") || s.session().contains("POWER"))
                .filter(s -> s.winRate() < 50)
                .findFirst()
                .ifPresent(s -> out.add("VWAP rejection after " + s.session()
                        + " shows weaker PUT follow-through historically."));

        report.putEntryQuality().stream()
                .filter(p -> p.grade().contains("PANIC") || p.grade().contains("LATE"))
                .findFirst()
                .ifPresent(p -> out.add(p.grade() + " entries produce weak PUT expectancy ("
                        + Math.round(p.followThroughPct()) + "% follow-through)."));

        report.breakdownProfiles().stream()
                .filter(b -> b.failedBouncePct() >= 50)
                .findFirst()
                .ifPresent(b -> out.add("Downside acceleration profile " + b.profile()
                        + " — failed bounce frequency " + Math.round(b.failedBouncePct()) + "%."));

        report.historicalVsLive().stream()
                .filter(v -> v.gapPct() >= 12)
                .findFirst()
                .ifPresent(v -> out.add("Bearish validation gap: " + v.regime() + " historical "
                        + Math.round(v.historicalWinPct()) + "% vs live assist "
                        + Math.round(v.paperWinPct()) + "%."));

        if (out.isEmpty()) {
            out.add("Bearish clusters forming — accumulate PUT assist + breakdown telemetry.");
        }
        return out;
    }
}
