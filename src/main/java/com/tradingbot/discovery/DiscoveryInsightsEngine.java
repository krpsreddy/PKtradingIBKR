package com.tradingbot.discovery;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Phase 203 §12 — evidence-backed insight sentences (advisory only). */
@Component
public class DiscoveryInsightsEngine {

    public DiscoveryDtos.DiscoveryInsightsDto generate(
            int sampleSize,
            List<DiscoveryDtos.RegimePerformanceRowDto> regimes,
            List<DiscoveryDtos.EntryQualityRowDto> entryQuality,
            List<DiscoveryDtos.StructureFitCellDto> structureFit,
            List<DiscoveryDtos.ExitQualityRowDto> exitQuality,
            List<DiscoveryDtos.FailureClusterDto> failures
    ) {
        List<String> insights = new ArrayList<>();
        String disclaimer = "Discovery only — human review required before changing execution logic.";

        if (sampleSize < 5) {
            insights.add("Insufficient closed trades in window — accumulate more paper execution telemetry.");
            return new DiscoveryDtos.DiscoveryInsightsDto(insights, sampleSize, disclaimer);
        }

        entryQuality.stream()
                .filter(e -> e.tradeCount() >= 3)
                .max(Comparator.comparingDouble(DiscoveryDtos.EntryQualityRowDto::winRate))
                .ifPresent(best -> entryQuality.stream()
                        .filter(e -> "CONFIRMED".equals(e.entryQuality()) && e.tradeCount() >= 3)
                        .findFirst()
                        .ifPresent(conf -> {
                            double delta = best.winRate() - conf.winRate();
                            if (delta >= 10) {
                                insights.add(String.format(
                                        "%s entries outperform CONFIRMED by %.0f%% win rate.",
                                        best.entryQuality(), delta));
                            }
                        }));

        structureFit.stream()
                .filter(c -> c.marketStructure().contains("CHOP") && c.tradeCount() >= 3)
                .filter(c -> c.continuationCapturePct() < 40)
                .findFirst()
                .ifPresent(c -> insights.add(
                        "CHOP environment reduces continuation capture for " + c.regime() + "."));

        exitQuality.stream()
                .filter(e -> e.tradeCount() >= 3)
                .max(Comparator.comparingDouble(DiscoveryDtos.ExitQualityRowDto::continuationCapturePct))
                .ifPresent(best -> insights.add(
                        best.exitType() + " exits show strongest continuation capture in sample."));

        regimes.stream()
                .filter(r -> r.tradeCount() >= 5 && r.continuationCapturePct() >= 55)
                .max(Comparator.comparing(DiscoveryDtos.RegimePerformanceRowDto::avgR))
                .ifPresent(r -> insights.add(
                        r.regime() + " shows robust continuation expectancy (capture "
                                + Math.round(r.continuationCapturePct()) + "%)."));

        failures.stream().findFirst().ifPresent(f -> insights.add(
                "Top failure cluster: " + f.clusterKey() + " (" + f.lossCount() + " losses)."));

        if (insights.isEmpty()) {
            insights.add("No strong comparative edges yet — widen lookback or increase paper sample.");
        }

        return new DiscoveryDtos.DiscoveryInsightsDto(insights, sampleSize, disclaimer);
    }
}
