package com.tradingbot.discovery.historical;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Phase 206 — bullish continuation insights only. */
@Component
public class BullishDiscoveryInsightsEngine {

    public List<String> generate(HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto report) {
        List<String> out = new ArrayList<>();
        if (report.meta().sampleCount() < 10) {
            out.add("Insufficient bullish history — hydrate 60D from Global Edge Lab then refresh.");
            return out;
        }

        report.regimeDiscovery().stream()
                .filter(r -> r.discoveryConfidenceScore() >= 65)
                .max(Comparator.comparingDouble(HistoricalBulkDiscoveryDtos.HistoricalRegimeRowDto::continuationProbability))
                .ifPresent(r -> out.add(r.regime() + " shows strongest persistence / second-leg expectancy ("
                        + Math.round(r.continuationProbability()) + "% continuation)."));

        report.continuationProfiles().stream()
                .filter(c -> c.secondLegProbability() >= 45)
                .findFirst()
                .ifPresent(c -> out.add("Pullback quality supports second-leg continuation in "
                        + c.profile() + " (" + Math.round(c.secondLegProbability()) + "%)."));

        report.sessionBehavior().stream()
                .filter(s -> s.continuationPct() >= 55)
                .findFirst()
                .ifPresent(s -> out.add("Ideal entry windows cluster in " + s.session()
                        + " (continuation " + Math.round(s.continuationPct()) + "%)."));

        report.historicalVsLive().stream()
                .filter(v -> v.gapPct() >= 15)
                .findFirst()
                .ifPresent(v -> out.add("Bullish gap: " + v.regime() + " historical "
                        + Math.round(v.historicalWinPct()) + "% vs paper "
                        + Math.round(v.paperWinPct()) + "% — execution review."));

        report.marketStructure().stream()
                .filter(m -> m.structure().contains("TREND") && m.continuationPct() >= 50)
                .findFirst()
                .ifPresent(m -> out.add("Healthy expansion regimes favor " + m.structure() + " environments."));

        if (out.isEmpty()) {
            out.add("Bullish patterns emerging — increase hydrated continuation history for confidence.");
        }
        return out;
    }
}
