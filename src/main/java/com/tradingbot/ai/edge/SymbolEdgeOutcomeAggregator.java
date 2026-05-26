package com.tradingbot.ai.edge;

import com.tradingbot.ai.dto.SymbolEdgeDtos.*;
import com.tradingbot.models.SignalOutcome;

import java.util.*;
import java.util.stream.Collectors;

/** Deterministic aggregation from backend signal outcomes (WIN / LOSS / NEUTRAL only). */
public final class SymbolEdgeOutcomeAggregator {

    private SymbolEdgeOutcomeAggregator() {}

    public static SymbolEdgeCompressedDto aggregate(String symbol, int lookbackDays, List<SignalOutcome> raw) {
        List<SignalOutcome> evaluated = raw.stream()
                .filter(o -> isEvaluated(o.getOutcome()))
                .toList();

        OverallStatsDto overall = overallStats(evaluated);
        List<SetupStatsDto> bySetup = bySetup(evaluated);
        List<RegimeStatsDto> byRegime = byRegime(evaluated);
        List<BucketStatsDto> byEntry = byEntryQuality(evaluated);
        List<BucketStatsDto> byTime = byTimeOfDay(evaluated);
        List<BucketStatsDto> byPremarket = byPremarketExtension(evaluated);

        SetupStatsDto bestSetup = pickSetupExtreme(bySetup, true);
        SetupStatsDto worstSetup = pickSetupExtreme(bySetup, false);
        RegimeStatsDto bestRegime = pickRegimeExtreme(byRegime, true);
        RegimeStatsDto worstRegime = pickRegimeExtreme(byRegime, false);

        LateEntryPenaltyDto latePenalty = lateEntryPenalty(byEntry);
        String bestTime = bestTimeWindow(byTime);

        Map<String, BucketStatsDto> premarketMap = byPremarket.stream()
                .collect(Collectors.toMap(BucketStatsDto::getBucket, b -> b, (a, b) -> a, LinkedHashMap::new));

        return SymbolEdgeCompressedDto.builder()
                .symbol(symbol)
                .lookbackDays(lookbackDays)
                .evaluatedTrades(evaluated.size())
                .overall(overall)
                .bestSetup(bestSetup)
                .worstSetup(worstSetup)
                .bestRegime(bestRegime)
                .worstRegime(worstRegime)
                .bestTimeWindow(bestTime)
                .lateEntryPenalty(latePenalty)
                .premarketExtension(premarketMap)
                .bySetup(bySetup)
                .byRegime(byRegime)
                .byEntryQuality(byEntry)
                .byRvol(List.of())
                .byTimeOfDay(byTime)
                .build();
    }

    public static String aggregateConfidence(int sampleCount) {
        return SymbolEdgeConfidenceUtil.label(sampleCount);
    }

    private static boolean isEvaluated(String outcome) {
        if (outcome == null) return false;
        String o = outcome.toUpperCase(Locale.ROOT);
        return "WIN".equals(o) || "LOSS".equals(o) || "NEUTRAL".equals(o);
    }

    private static OverallStatsDto overallStats(List<SignalOutcome> evaluated) {
        int n = evaluated.size();
        if (n == 0) {
            return OverallStatsDto.builder()
                    .trades(0).winRate(0).expectancy(0).avgMfe(0).avgMae(0)
                    .hit1RRate(0).hit2RRate(0).confidence("LOW").build();
        }
        long wins = evaluated.stream().filter(o -> "WIN".equalsIgnoreCase(o.getOutcome())).count();
        double winRate = pct(wins, n);
        double expectancy = avg(evaluated.stream().map(SymbolEdgeOutcomeAggregator::expectancyR).toList());
        double avgMfe = avg(evaluated.stream().map(o -> nz(o.getMaxFavorableExcursion())).toList());
        double avgMae = avg(evaluated.stream().map(o -> nz(o.getMaxAdverseExcursion())).toList());
        long hit1 = evaluated.stream().filter(o -> nz(o.getRrAchieved()) >= 1.0).count();
        long hit2 = evaluated.stream().filter(o -> nz(o.getRrAchieved()) >= 2.0).count();

        return OverallStatsDto.builder()
                .trades(n)
                .winRate(winRate)
                .expectancy(expectancy)
                .avgMfe(round2(avgMfe))
                .avgMae(round2(avgMae))
                .hit1RRate(pct(hit1, n))
                .hit2RRate(pct(hit2, n))
                .confidence(SymbolEdgeConfidenceUtil.label(n))
                .build();
    }

    private static List<SetupStatsDto> bySetup(List<SignalOutcome> evaluated) {
        return group(evaluated, o -> nz(o.getSetupType(), "UNKNOWN")).entrySet().stream()
                .map(e -> setupRow(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingDouble(SetupStatsDto::getExpectancy).reversed())
                .toList();
    }

    private static SetupStatsDto setupRow(String type, List<SignalOutcome> rows) {
        int n = rows.size();
        long wins = rows.stream().filter(o -> "WIN".equalsIgnoreCase(o.getOutcome())).count();
        return SetupStatsDto.builder()
                .type(type)
                .sample(n)
                .winRate(pct(wins, n))
                .expectancy(round2(avg(rows.stream().map(SymbolEdgeOutcomeAggregator::expectancyR).toList())))
                .avgMfe(round2(avg(rows.stream().map(o -> nz(o.getMaxFavorableExcursion())).toList())))
                .avgMae(round2(avg(rows.stream().map(o -> nz(o.getMaxAdverseExcursion())).toList())))
                .confidence(SymbolEdgeConfidenceUtil.label(n))
                .build();
    }

    private static List<RegimeStatsDto> byRegime(List<SignalOutcome> evaluated) {
        return group(evaluated, o -> nz(o.getRegime(), "UNKNOWN")).entrySet().stream()
                .map(e -> regimeRow(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingDouble(RegimeStatsDto::getExpectancy).reversed())
                .toList();
    }

    private static RegimeStatsDto regimeRow(String name, List<SignalOutcome> rows) {
        int n = rows.size();
        long wins = rows.stream().filter(o -> "WIN".equalsIgnoreCase(o.getOutcome())).count();
        double contQuality = avg(rows.stream()
                .map(o -> nz(o.getContinuationDistance()))
                .filter(v -> v > 0)
                .toList());
        return RegimeStatsDto.builder()
                .name(name)
                .sample(n)
                .winRate(pct(wins, n))
                .expectancy(round2(avg(rows.stream().map(SymbolEdgeOutcomeAggregator::expectancyR).toList())))
                .continuationQuality(contQuality > 0 ? round2(contQuality) : null)
                .confidence(SymbolEdgeConfidenceUtil.label(n))
                .build();
    }

    private static List<BucketStatsDto> byEntryQuality(List<SignalOutcome> evaluated) {
        return List.of("IDEAL", "GOOD", "LATE", "CHASE").stream()
                .map(q -> bucketForQuality(q, evaluated.stream()
                        .filter(o -> q.equalsIgnoreCase(nz(o.getEntryQuality(), inferEntryQuality(o))))
                        .toList()))
                .filter(b -> b.getSample() > 0)
                .toList();
    }

    private static String inferEntryQuality(SignalOutcome o) {
        if (o.getTradeQualityGrade() != null) {
            String g = o.getTradeQualityGrade().toUpperCase(Locale.ROOT);
            if (g.startsWith("A")) return "IDEAL";
            if (g.startsWith("B")) return "GOOD";
            if (g.startsWith("C")) return "LATE";
            return "CHASE";
        }
        return "GOOD";
    }

    private static List<BucketStatsDto> byTimeOfDay(List<SignalOutcome> evaluated) {
        Map<String, String> bucketMap = Map.of(
                "OPEN", "9:30–9:45",
                "EARLY", "9:45–10:15",
                "MID_MORNING", "10:15–11:00",
                "MIDDAY", "11:00+",
                "AFTERNOON", "11:00+"
        );
        return group(evaluated, o -> mapTimeBucket(o.getTimeOfDay())).entrySet().stream()
                .map(e -> bucketRow(bucketMap.getOrDefault(e.getKey(), e.getKey()), e.getValue()))
                .sorted(Comparator.comparingDouble(BucketStatsDto::getExpectancy).reversed())
                .toList();
    }

    private static String mapTimeBucket(String timeOfDay) {
        if (timeOfDay == null) return "UNKNOWN";
        return timeOfDay.toUpperCase(Locale.ROOT);
    }

    private static List<BucketStatsDto> byPremarketExtension(List<SignalOutcome> evaluated) {
        return List.of("<2%", "2–5%", "5–8%", ">8%").stream()
                .map(label -> {
                    List<SignalOutcome> rows = evaluated.stream()
                            .filter(o -> premarketBucket(nz(o.getExtensionDistance()) * 100).equals(label))
                            .toList();
                    return bucketRow(label, rows);
                })
                .filter(b -> b.getSample() > 0)
                .toList();
    }

    private static String premarketBucket(double pct) {
        if (pct < 2) return "<2%";
        if (pct < 5) return "2–5%";
        if (pct < 8) return "5–8%";
        return ">8%";
    }

    private static BucketStatsDto bucketRow(String bucket, List<SignalOutcome> rows) {
        int n = rows.size();
        long wins = rows.stream().filter(o -> "WIN".equalsIgnoreCase(o.getOutcome())).count();
        long losses = rows.stream().filter(o -> "LOSS".equalsIgnoreCase(o.getOutcome())).count();
        double cont = avg(rows.stream().map(o -> nz(o.getContinuationDistance())).filter(v -> v > 0).toList());
        return BucketStatsDto.builder()
                .bucket(bucket)
                .sample(n)
                .winRate(pct(wins, n))
                .expectancy(round2(avg(rows.stream().map(SymbolEdgeOutcomeAggregator::expectancyR).toList())))
                .avgMfe(round2(avg(rows.stream().map(o -> nz(o.getMaxFavorableExcursion())).toList())))
                .avgMae(round2(avg(rows.stream().map(o -> nz(o.getMaxAdverseExcursion())).toList())))
                .failureRate(pct(losses, n))
                .continuationRate(cont > 0 ? round2(cont * 100) : null)
                .confidence(SymbolEdgeConfidenceUtil.label(n))
                .build();
    }

    private static BucketStatsDto bucketForQuality(String bucket, List<SignalOutcome> rows) {
        return bucketRow(bucket, rows);
    }

    private static LateEntryPenaltyDto lateEntryPenalty(List<BucketStatsDto> byEntry) {
        double ideal = byEntry.stream()
                .filter(b -> "IDEAL".equals(b.getBucket()) || "GOOD".equals(b.getBucket()))
                .mapToDouble(BucketStatsDto::getExpectancy)
                .average().orElse(0);
        double late = byEntry.stream()
                .filter(b -> "LATE".equals(b.getBucket()) || "CHASE".equals(b.getBucket()))
                .mapToDouble(BucketStatsDto::getExpectancy)
                .average().orElse(0);
        double drop = ideal > 0.01 ? Math.min(99, Math.max(0, (1 - late / ideal) * 100)) : 0;
        return LateEntryPenaltyDto.builder()
                .idealExpectancy(round2(ideal))
                .lateExpectancy(round2(late))
                .expectancyDropPct(round2(drop))
                .build();
    }

    private static String bestTimeWindow(List<BucketStatsDto> byTime) {
        return byTime.stream()
                .filter(b -> b.getSample() >= 3)
                .max(Comparator.comparingDouble(BucketStatsDto::getExpectancy))
                .map(BucketStatsDto::getBucket)
                .orElse("—");
    }

    private static SetupStatsDto pickSetupExtreme(List<SetupStatsDto> rows, boolean best) {
        List<SetupStatsDto> eligible = rows.stream().filter(r -> r.getSample() >= 3).toList();
        if (eligible.isEmpty()) return null;
        Comparator<SetupStatsDto> cmp = Comparator.comparingDouble(SetupStatsDto::getExpectancy);
        return best ? eligible.stream().max(cmp).orElse(null) : eligible.stream().min(cmp).orElse(null);
    }

    private static RegimeStatsDto pickRegimeExtreme(List<RegimeStatsDto> rows, boolean best) {
        List<RegimeStatsDto> eligible = rows.stream().filter(r -> r.getSample() >= 3).toList();
        if (eligible.isEmpty()) return null;
        Comparator<RegimeStatsDto> cmp = Comparator.comparingDouble(RegimeStatsDto::getExpectancy);
        return best
                ? eligible.stream().max(cmp).orElse(null)
                : eligible.stream().min(cmp).orElse(null);
    }

    private static double expectancyR(SignalOutcome o) {
        if (o.getRrAchieved() != null) return o.getRrAchieved();
        if ("WIN".equalsIgnoreCase(o.getOutcome())) return Math.max(0.5, nz(o.getMaxFavorableExcursion()) * 10);
        if ("LOSS".equalsIgnoreCase(o.getOutcome())) return -Math.max(0.5, nz(o.getMaxAdverseExcursion()) * 10);
        return 0;
    }

    private static Map<String, List<SignalOutcome>> group(List<SignalOutcome> rows, java.util.function.Function<SignalOutcome, String> keyFn) {
        return rows.stream().collect(Collectors.groupingBy(keyFn, LinkedHashMap::new, Collectors.toList()));
    }

    private static double pct(long num, int den) {
        if (den <= 0) return 0;
        return round2(num * 100.0 / den);
    }

    private static double avg(List<Double> values) {
        if (values.isEmpty()) return 0;
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    }

    private static double nz(Double v) {
        return v == null ? 0 : v;
    }

    private static String nz(String v, String fallback) {
        return v == null || v.isBlank() ? fallback : v;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
