package com.tradingbot.discovery.historical;

import com.tradingbot.analytics.storage.AnalyticsVersionService;
import com.tradingbot.analytics.storage.entity.EvaluatedSignalSnapshotEntity;
import com.tradingbot.analytics.storage.repository.EvaluatedSignalSnapshotRepository;
import com.tradingbot.discovery.DiscoveryDtos;
import com.tradingbot.discovery.DiscoveryLookback;
import com.tradingbot.discovery.RegimeIntelligenceDiscoveryService;
import com.tradingbot.livetrader.portfolio.CorrelationSuppressionEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Phase 204 — historical bulk discovery from evaluated_signal_snapshots (cached, non-blocking).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HistoricalBulkDiscoveryService {

    private static final ZoneId ET = ZoneId.of("America/New_York");
    private static final int PAGE_SIZE = 500;
    private static final int MAX_ROWS = 8000;

    private final EvaluatedSignalSnapshotRepository snapshotRepository;
    private final AnalyticsVersionService versionService;
    private final RegimeIntelligenceDiscoveryService executionDiscovery;
    private final DiscoveryConfidenceScorer confidenceScorer;
    private final BearishDiscoveryConfidenceScorer bearishConfidenceScorer;
    private final BullishDiscoveryInsightsEngine bullishInsightsEngine;
    private final BearishDiscoveryInsightsEngine bearishInsightsEngine;
    private final CorrelationSuppressionEngine sectorEngine;

    private final Map<String, CachedHistorical> cache = new ConcurrentHashMap<>();

    public HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto report(int days) {
        return report(days, DiscoveryDirection.BULLISH);
    }

    public HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto report(int days, DiscoveryDirection direction) {
        int norm = DiscoveryLookback.normalizeDays(days);
        String cacheKey = direction.name() + ":" + norm;
        CachedHistorical c = cache.get(cacheKey);
        if (c != null && System.currentTimeMillis() - c.atMs < 300_000) {
            return c.report;
        }
        HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto built = build(norm, direction);
        cache.put(cacheKey, new CachedHistorical(built, System.currentTimeMillis()));
        return built;
    }

    @Async("discoveryExecutor")
    public CompletableFuture<HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto> reportAsync(int days) {
        return CompletableFuture.completedFuture(report(days));
    }

    @Async("discoveryExecutor")
    public CompletableFuture<HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto> reportAsync(
            int days, DiscoveryDirection direction
    ) {
        return CompletableFuture.completedFuture(report(days, direction));
    }

    public void evictCache() {
        cache.clear();
    }

    private HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto build(int days, DiscoveryDirection direction) {
        List<EvaluatedSignalSnapshotEntity> all = loadSnapshots(days);
        List<EvaluatedSignalSnapshotEntity> rows = all.stream()
                .filter(e -> DiscoveryDirectionClassifier.matches(direction, e))
                .toList();
        SnapshotAgg agg = SnapshotAgg.from(rows, sectorEngine, confidenceScorer, bearishConfidenceScorer, direction);

        var regimeDiscovery = agg.regimeRows();
        var families = agg.familyClusters();
        var structure = agg.marketStructure();
        var continuation = agg.continuationProfiles();
        var failures = agg.failureClusters();
        var sectors = agg.sectorDna();
        var sessions = agg.sessionBehavior();
        var maturity = agg.trendMaturity();
        var evolution = agg.regimeEvolution();
        var vsLive = buildHistoricalVsLive(regimeDiscovery, days, direction);
        var putQuality = direction == DiscoveryDirection.BEARISH ? agg.putEntryQuality() : List.<HistoricalBulkDiscoveryDtos.PutEntryQualityRowDto>of();
        var squeeze = direction == DiscoveryDirection.BEARISH ? agg.squeezeRisk() : List.<HistoricalBulkDiscoveryDtos.SqueezeRiskRowDto>of();
        var breakdown = direction == DiscoveryDirection.BEARISH ? agg.breakdownProfiles() : List.<HistoricalBulkDiscoveryDtos.BreakdownProfileRowDto>of();

        String disclaimer = direction == DiscoveryDirection.BULLISH
                ? "Bullish continuation research only — persistence, pullbacks, second-leg expansion."
                : "Bearish breakdown / PUT assist research — rejection, collapse, squeeze risk (not inverted bullish).";
        var meta = new HistoricalBulkDiscoveryDtos.HistoricalMetaDto(
                days, rows.size(), System.currentTimeMillis(), disclaimer,
                direction.name(), direction == DiscoveryDirection.BULLISH
                        ? "Continuation · persistence · expansion"
                        : "Breakdown · rejection · PUT assist");

        var top = regimeDiscovery.stream()
                .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.HistoricalRegimeRowDto::discoveryConfidenceScore).reversed())
                .limit(8)
                .toList();

        var draft = new HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto(
                meta, List.of(), regimeDiscovery, families, structure, continuation,
                failures, sectors, sessions, maturity, evolution, vsLive, top,
                putQuality, squeeze, breakdown);
        List<String> insights = direction == DiscoveryDirection.BEARISH
                ? bearishInsightsEngine.generate(draft)
                : bullishInsightsEngine.generate(draft);

        return new HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto(
                meta, insights, regimeDiscovery, families, structure, continuation,
                failures, sectors, sessions, maturity, evolution, vsLive, top,
                putQuality, squeeze, breakdown);
    }

    private List<HistoricalBulkDiscoveryDtos.HistoricalVsLiveRowDto> buildHistoricalVsLive(
            List<HistoricalBulkDiscoveryDtos.HistoricalRegimeRowDto> historical,
            int days,
            DiscoveryDirection direction
    ) {
        List<HistoricalBulkDiscoveryDtos.HistoricalVsLiveRowDto> rows = new ArrayList<>();
        if (direction == DiscoveryDirection.BEARISH) {
            List<DiscoveryDtos.BearishAssistRowDto> assist = executionDiscovery.bearishAnalysis(days);
            Map<String, DiscoveryDtos.BearishAssistRowDto> byState = assist.stream()
                    .collect(Collectors.toMap(
                            b -> b.bearishState().toUpperCase(Locale.US),
                            b -> b,
                            (a, b) -> a));
            for (var h : historical.stream().limit(15).toList()) {
                String key = h.regime().toUpperCase(Locale.US);
                DiscoveryDtos.BearishAssistRowDto live = byState.get(key);
                if (live == null) {
                    live = assist.stream().findFirst().orElse(null);
                }
                double liveFollow = live != null ? live.avgBias() : 0;
                double gap = Math.abs(h.winRate() - liveFollow);
                String verdict = gap >= 15 ? "PUT_FOLLOW_GAP" : gap <= 8 ? "ALIGNED" : "MIXED";
                rows.add(new HistoricalBulkDiscoveryDtos.HistoricalVsLiveRowDto(
                        h.regime(), h.winRate(), liveFollow, h.continuationProbability(), liveFollow,
                        gap, verdict));
            }
        } else {
            List<DiscoveryDtos.RegimePerformanceRowDto> paper = executionDiscovery.regimePerformance(days);
            Map<String, DiscoveryDtos.RegimePerformanceRowDto> paperByRegime = paper.stream()
                    .collect(Collectors.toMap(
                            p -> p.regime().toUpperCase(Locale.US),
                            p -> p,
                            (a, b) -> a));
            for (var h : historical.stream().limit(15).toList()) {
                String key = h.regime().toUpperCase(Locale.US);
                DiscoveryDtos.RegimePerformanceRowDto p = paperByRegime.get(key);
                double paperWin = p != null ? p.winRate() : 0;
                double paperCap = p != null ? p.continuationCapturePct() : 0;
                double gap = h.winRate() - paperWin;
                String verdict = gap >= 15 ? "EXECUTION_GAP" : gap <= -10 ? "PAPER_OUTPERFORMS" : "ALIGNED";
                rows.add(new HistoricalBulkDiscoveryDtos.HistoricalVsLiveRowDto(
                        h.regime(), h.winRate(), paperWin, h.continuationProbability(), paperCap,
                        Math.abs(gap), verdict));
            }
        }
        return rows.stream()
                .sorted(Comparator.comparingDouble(HistoricalBulkDiscoveryDtos.HistoricalVsLiveRowDto::gapPct).reversed())
                .toList();
    }

    private List<EvaluatedSignalSnapshotEntity> loadSnapshots(int days) {
        long fromTs = System.currentTimeMillis() - (long) days * 86_400_000L;
        int version = versionService.currentVersion();
        List<EvaluatedSignalSnapshotEntity> all = new ArrayList<>();
        int page = 0;
        while (all.size() < MAX_ROWS) {
            var batch = snapshotRepository.findByTimestampMsGreaterThanEqualAndAnalyticsVersionOrderByTimestampMsDesc(
                    fromTs, version, PageRequest.of(page++, PAGE_SIZE));
            if (batch.isEmpty()) break;
            all.addAll(batch);
            if (batch.size() < PAGE_SIZE) break;
        }
        return all;
    }

    private record CachedHistorical(HistoricalBulkDiscoveryDtos.HistoricalBulkDiscoveryReportDto report, long atMs) {}

    /** In-memory aggregation from snapshot rows. */
    static final class SnapshotAgg {
        private final List<Row> rows;
        private final DiscoveryConfidenceScorer scorer;
        private final BearishDiscoveryConfidenceScorer bearishScorer;
        private final DiscoveryDirection direction;

        SnapshotAgg(List<Row> rows, DiscoveryConfidenceScorer scorer,
                    BearishDiscoveryConfidenceScorer bearishScorer, DiscoveryDirection direction) {
            this.rows = rows;
            this.scorer = scorer;
            this.bearishScorer = bearishScorer;
            this.direction = direction;
        }

        static SnapshotAgg from(
                List<EvaluatedSignalSnapshotEntity> entities,
                CorrelationSuppressionEngine sector,
                DiscoveryConfidenceScorer scorer,
                BearishDiscoveryConfidenceScorer bearishScorer,
                DiscoveryDirection direction
        ) {
            List<Row> rows = entities.stream().map(e -> Row.from(e, sector, direction)).toList();
            return new SnapshotAgg(rows, scorer, bearishScorer, direction);
        }

        List<HistoricalBulkDiscoveryDtos.HistoricalRegimeRowDto> regimeRows() {
            return groupBy(r -> r.regime).entrySet().stream()
                    .map(e -> regimeRow(e.getKey(), e.getValue()))
                    .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.HistoricalRegimeRowDto::frequency).reversed())
                    .limit(25)
                    .toList();
        }

        List<HistoricalBulkDiscoveryDtos.RegimeFamilyClusterDto> familyClusters() {
            return groupBy(r -> r.family).entrySet().stream()
                    .map(e -> {
                        List<Row> list = e.getValue();
                        int n = list.size();
                        double wr = winPct(list);
                        double cont = contPct(list);
                        double fail = 100 - wr;
                        int score = direction == DiscoveryDirection.BEARISH
                                ? bearishScorer.score(n, wr, cont, avgSqueeze(list))
                                : scorer.score(n, wr, cont, fail);
                        Set<String> regimes = list.stream().map(r -> r.regime).limit(6).collect(Collectors.toCollection(LinkedHashSet::new));
                        return new HistoricalBulkDiscoveryDtos.RegimeFamilyClusterDto(
                                e.getKey(), n, round1(wr), round2(avgMfe(list)), round1(cont),
                                new ArrayList<>(regimes), score);
                    })
                    .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.RegimeFamilyClusterDto::discoveryConfidenceScore).reversed())
                    .toList();
        }

        List<HistoricalBulkDiscoveryDtos.PutEntryQualityRowDto> putEntryQuality() {
            return groupBy(r -> r.putEntryGrade).entrySet().stream()
                    .map(e -> {
                        List<Row> list = e.getValue();
                        int n = list.size();
                        double wr = winPct(list);
                        double breakdown = breakdownSurvival(list);
                        int score = bearishScorer.score(n, wr, breakdown, avgSqueeze(list));
                        return new HistoricalBulkDiscoveryDtos.PutEntryQualityRowDto(
                                e.getKey(), n, round1(wr), round1(breakdown), score);
                    })
                    .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.PutEntryQualityRowDto::discoveryConfidenceScore).reversed())
                    .toList();
        }

        List<HistoricalBulkDiscoveryDtos.SqueezeRiskRowDto> squeezeRisk() {
            return groupBy(r -> r.marketStructure + " · " + r.session).entrySet().stream()
                    .map(e -> {
                        List<Row> list = e.getValue();
                        int avg = (int) Math.round(list.stream().mapToInt(r -> r.squeezeRiskScore).average().orElse(0));
                        String note = avg >= 60 ? "Elevated squeeze / exhaustion bounce risk"
                                : avg >= 40 ? "Moderate reversal risk" : "Lower squeeze risk";
                        return new HistoricalBulkDiscoveryDtos.SqueezeRiskRowDto(
                                e.getKey(), list.size(), avg, note);
                    })
                    .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.SqueezeRiskRowDto::squeezeRiskScore).reversed())
                    .limit(10)
                    .toList();
        }

        List<HistoricalBulkDiscoveryDtos.BreakdownProfileRowDto> breakdownProfiles() {
            return groupBy(r -> r.continuationHealth).entrySet().stream()
                    .map(e -> {
                        List<Row> list = e.getValue();
                        return new HistoricalBulkDiscoveryDtos.BreakdownProfileRowDto(
                                e.getKey(), list.size(), round1(breakdownSurvival(list)),
                                round1(failedBounce(list)), round1(acceleration(list)), round1(avgSqueeze(list)));
                    })
                    .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.BreakdownProfileRowDto::sampleCount).reversed())
                    .limit(10)
                    .toList();
        }

        List<HistoricalBulkDiscoveryDtos.MarketStructureRowDto> marketStructure() {
            return groupBy(r -> r.marketStructure).entrySet().stream()
                    .map(e -> {
                        List<Row> list = e.getValue();
                        return new HistoricalBulkDiscoveryDtos.MarketStructureRowDto(
                                e.getKey(), list.size(), round1(winPct(list)), round1(contPct(list)),
                                contPct(list) >= 50 ? "Favorable" : "Hostile");
                    })
                    .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.MarketStructureRowDto::sampleCount).reversed())
                    .limit(12)
                    .toList();
        }

        List<HistoricalBulkDiscoveryDtos.ContinuationProfileRowDto> continuationProfiles() {
            return groupBy(r -> r.continuationHealth).entrySet().stream()
                    .map(e -> {
                        List<Row> list = e.getValue();
                        return new HistoricalBulkDiscoveryDtos.ContinuationProfileRowDto(
                                e.getKey(), list.size(), round1(persistSurvival(list)),
                                round1(secondLeg(list)), round1(exhaustionScore(list)), round1(trendDecay(list)));
                    })
                    .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.ContinuationProfileRowDto::sampleCount).reversed())
                    .limit(10)
                    .toList();
        }

        List<HistoricalBulkDiscoveryDtos.HistoricalFailureClusterDto> failureClusters() {
            List<Row> losses = rows.stream().filter(r -> !r.win).toList();
            if (losses.isEmpty()) return List.of();
            int total = losses.size();
            return losses.stream()
                    .collect(Collectors.groupingBy(r -> r.failureKey()))
                    .entrySet().stream()
                    .map(e -> new HistoricalBulkDiscoveryDtos.HistoricalFailureClusterDto(
                            e.getKey(), e.getValue().size(), round1(e.getValue().size() * 100.0 / total),
                            List.of(e.getKey().split("\\+"))))
                    .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.HistoricalFailureClusterDto::failureCount).reversed())
                    .limit(12)
                    .toList();
        }

        List<HistoricalBulkDiscoveryDtos.SectorDnaRowDto> sectorDna() {
            return groupBy(r -> r.sector).entrySet().stream()
                    .map(e -> {
                        List<Row> list = e.getValue();
                        double cont = contPct(list);
                        double fail = 100 - winPct(list);
                        String note = cont >= 55 ? "Strong continuation persistence" :
                                fail >= 55 ? "High failure volatility" : "Mixed";
                        return new HistoricalBulkDiscoveryDtos.SectorDnaRowDto(
                                e.getKey(), list.size(), round1(cont), round1(fail), note);
                    })
                    .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.SectorDnaRowDto::sampleCount).reversed())
                    .toList();
        }

        List<HistoricalBulkDiscoveryDtos.SessionBehaviorRowDto> sessionBehavior() {
            return groupBy(r -> r.session).entrySet().stream()
                    .map(e -> {
                        List<Row> list = e.getValue();
                        String top = list.stream().collect(Collectors.groupingBy(r -> r.regime, Collectors.counting()))
                                .entrySet().stream().max(Map.Entry.comparingByValue())
                                .map(Map.Entry::getKey).orElse("—");
                        return new HistoricalBulkDiscoveryDtos.SessionBehaviorRowDto(
                                e.getKey(), list.size(), round1(winPct(list)), round1(contPct(list)), top);
                    })
                    .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.SessionBehaviorRowDto::sampleCount).reversed())
                    .toList();
        }

        List<HistoricalBulkDiscoveryDtos.TrendMaturityRowDto> trendMaturity() {
            return groupBy(r -> r.trendMaturity).entrySet().stream()
                    .map(e -> {
                        List<Row> list = e.getValue();
                        return new HistoricalBulkDiscoveryDtos.TrendMaturityRowDto(
                                e.getKey(), list.size(), round1(contPct(list)), round1(100 - winPct(list)));
                    })
                    .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.TrendMaturityRowDto::sampleCount).reversed())
                    .toList();
        }

        List<HistoricalBulkDiscoveryDtos.RegimeEvolutionPathDto> regimeEvolution() {
            Map<String, List<Row>> byPath = new HashMap<>();
            for (Row r : rows) {
                if (r.evolutionPath == null) continue;
                byPath.computeIfAbsent(r.evolutionPath, k -> new ArrayList<>()).add(r);
            }
            return byPath.entrySet().stream()
                    .map(e -> new HistoricalBulkDiscoveryDtos.RegimeEvolutionPathDto(
                            e.getKey(), e.getValue().size(), round1(winPct(e.getValue()))))
                    .sorted(Comparator.comparingInt(HistoricalBulkDiscoveryDtos.RegimeEvolutionPathDto::occurrences).reversed())
                    .limit(12)
                    .toList();
        }

        private Map<String, List<Row>> groupBy(java.util.function.Function<Row, String> keyFn) {
            return rows.stream().collect(Collectors.groupingBy(keyFn));
        }

        private HistoricalBulkDiscoveryDtos.HistoricalRegimeRowDto regimeRow(String regime, List<Row> list) {
            int n = list.size();
            double wr = winPct(list);
            double cont = contPct(list);
            double fail = 100 - wr;
            int score = direction == DiscoveryDirection.BEARISH
                    ? bearishScorer.score(n, wr, cont, avgSqueeze(list))
                    : scorer.score(n, wr, cont, fail);
            String label = direction == DiscoveryDirection.BEARISH
                    ? bearishScorer.expectancyLabel(score, wr)
                    : scorer.expectancyLabel(score, wr);
            return new HistoricalBulkDiscoveryDtos.HistoricalRegimeRowDto(
                    regime, n, round1(wr), round2(avgMfe(list)), round1(cont),
                    round1(secondLeg(list)), round1(fail), score, label);
        }

        private static double breakdownSurvival(List<Row> list) {
            return list.stream().filter(r -> r.breakdownContinuation).count() * 100.0 / Math.max(1, list.size());
        }

        private static double failedBounce(List<Row> list) {
            return list.stream().filter(r -> r.failedBounce).count() * 100.0 / Math.max(1, list.size());
        }

        private static double acceleration(List<Row> list) {
            return list.stream().filter(r -> r.mfeR >= 1.0 && !r.win).count() * 100.0 / Math.max(1, list.size());
        }

        private static double avgSqueeze(List<Row> list) {
            return list.stream().mapToInt(r -> r.squeezeRiskScore).average().orElse(0);
        }

        private static double winPct(List<Row> list) {
            return list.isEmpty() ? 0 : list.stream().filter(r -> r.win).count() * 100.0 / list.size();
        }

        private static double contPct(List<Row> list) {
            return list.stream().filter(r -> r.continuation).count() * 100.0 / Math.max(1, list.size());
        }

        private static double secondLeg(List<Row> list) {
            return list.stream().filter(r -> r.secondLeg).count() * 100.0 / Math.max(1, list.size());
        }

        private static double persistSurvival(List<Row> list) {
            return list.stream().filter(r -> r.persistenceOk).count() * 100.0 / Math.max(1, list.size());
        }

        private static double exhaustionScore(List<Row> list) {
            return list.stream().filter(r -> r.exhausted).count() * 100.0 / Math.max(1, list.size());
        }

        private static double trendDecay(List<Row> list) {
            return list.stream().filter(r -> r.trendMaturity.contains("EXHAUST") || r.trendMaturity.contains("FAILED"))
                    .count() * 100.0 / Math.max(1, list.size());
        }

        private static double avgMfe(List<Row> list) {
            return list.stream().mapToDouble(r -> r.mfeR).average().orElse(0);
        }

        private static double round1(double v) {
            return Math.round(v * 10) / 10.0;
        }

        private static double round2(double v) {
            return Math.round(v * 100) / 100.0;
        }
    }

    static final class Row {
        final String regime;
        final String family;
        final String marketStructure;
        final String continuationHealth;
        final String sector;
        final String session;
        final String trendMaturity;
        final String evolutionPath;
        final boolean win;
        final boolean continuation;
        final boolean secondLeg;
        final boolean persistenceOk;
        final boolean exhausted;
        final double mfeR;
        final String putEntryGrade;
        final boolean breakdownContinuation;
        final boolean failedBounce;
        final int squeezeRiskScore;

        Row(String regime, String family, String marketStructure, String continuationHealth,
            String sector, String session, String trendMaturity, String evolutionPath,
            boolean win, boolean continuation, boolean secondLeg, boolean persistenceOk,
            boolean exhausted, double mfeR, String putEntryGrade, boolean breakdownContinuation,
            boolean failedBounce, int squeezeRiskScore) {
            this.regime = regime;
            this.family = family;
            this.marketStructure = marketStructure;
            this.continuationHealth = continuationHealth;
            this.sector = sector;
            this.session = session;
            this.trendMaturity = trendMaturity;
            this.evolutionPath = evolutionPath;
            this.win = win;
            this.continuation = continuation;
            this.secondLeg = secondLeg;
            this.persistenceOk = persistenceOk;
            this.exhausted = exhausted;
            this.mfeR = mfeR;
            this.putEntryGrade = putEntryGrade;
            this.breakdownContinuation = breakdownContinuation;
            this.failedBounce = failedBounce;
            this.squeezeRiskScore = squeezeRiskScore;
        }

        static Row from(EvaluatedSignalSnapshotEntity e, CorrelationSuppressionEngine sector,
                          DiscoveryDirection direction) {
            String regime = nz(e.getRegime(), e.getSetup(), "UNKNOWN");
            boolean win = "WIN".equalsIgnoreCase(e.getWinLoss());
            double mfe = e.getMfe() != null ? e.getMfe() : 0;
            double mfeR = mfe > 3 ? mfe / 100.0 : mfe;
            boolean cont = e.getContinuationPercent() != null && e.getContinuationPercent() >= 50
                    || mfeR >= 1.0;
            boolean secondLeg = mfeR >= 1.5;
            String health = nz(e.getContinuationHealth(), null, "NEUTRAL");
            boolean persistOk = !health.toUpperCase().contains("FAIL") && !health.toUpperCase().contains("WEAK");
            boolean exhausted = health.toUpperCase().contains("EXHAUST")
                    || (e.getNarrativePath() != null && e.getNarrativePath().toUpperCase().contains("EXHAUST"));
            String market = normalizeStructure(e.getMarketCondition());
            String session = sessionFromTs(e.getTimestampMs());
            String maturity = inferMaturity(mfeR, cont, exhausted);
            String path = simplifyEvolution(e.getNarrativePath());
            boolean breakdown = cont || mfeR >= 0.8;
            boolean failedBounce = health.toUpperCase().contains("FAIL") || health.toUpperCase().contains("WEAK");
            String putGrade = inferPutEntryGrade(session, exhausted, mfeR, health, win);
            int squeeze = computeSqueezeRisk(exhausted, market, health, mfeR);
            return new Row(regime, RegimeFamilyMapper.familyFor(direction, e.getRegime(), e.getSetup()),
                    market, health, sector.clusterFor(e.getSymbol()), session, maturity, path,
                    win, cont, secondLeg, persistOk, exhausted, mfeR, putGrade, breakdown, failedBounce, squeeze);
        }

        private static String inferPutEntryGrade(String session, boolean exhausted, double mfeR,
                                                 String health, boolean win) {
            if (health.toUpperCase().contains("SQUEEZE") || (exhausted && mfeR < 0.5)) {
                return "SQUEEZE_RISK";
            }
            if (session.equals("POWER_HOUR") && mfeR >= 1.8) return "LATE_FLUSH";
            if (mfeR >= 2.0 && !win) return "PANIC_CHASE";
            if (health.toUpperCase().contains("RECLAIM") || health.toUpperCase().contains("REJECT")) {
                return "FAILED_RECLAIM";
            }
            if (health.toUpperCase().contains("WEAK")) return "WEAK_REJECTION";
            if (mfeR >= 1.0 && win) return "IDEAL_BREAKDOWN";
            return "BREAKDOWN_CONFIRM";
        }

        private static int computeSqueezeRisk(boolean exhausted, String market, String health, double mfeR) {
            int s = 20;
            if (exhausted) s += 25;
            if (market.contains("CHOP") || market.contains("MIXED")) s += 15;
            if (health.toUpperCase().contains("EXHAUST")) s += 20;
            if (mfeR < 0.3) s += 10;
            if (mfeR > 2.5) s += 15;
            return Math.min(100, s);
        }

        String failureKey() {
            return marketStructure + " + " + regime + " + " + session
                    + (mfeR < 0.3 ? " + WEAK_EXPANSION" : "");
        }

        private static String nz(String a, String b, String def) {
            if (a != null && !a.isBlank()) return a;
            if (b != null && !b.isBlank()) return b;
            return def;
        }

        private static String normalizeStructure(String mc) {
            if (mc == null || mc.isBlank()) return "MIXED";
            String u = mc.toUpperCase(Locale.US);
            if (u.contains("CHOP")) return "CHOP";
            if (u.contains("TREND") && u.contains("BULL")) return "TREND_DAY_BULL";
            if (u.contains("TREND") && u.contains("BEAR")) return "TREND_DAY_BEAR";
            if (u.contains("FAIL") && u.contains("BREAK")) return "FAILED_BREAKOUT_ENV";
            if (u.contains("OPEN")) return "OPENING_DRIVE";
            if (u.contains("DISTRIB")) return "DISTRIBUTION_ENV";
            return u.length() > 24 ? u.substring(0, 24) : u;
        }

        private static String sessionFromTs(Long ts) {
            if (ts == null) return "UNKNOWN";
            int hour = java.time.Instant.ofEpochMilli(ts).atZone(ET).getHour();
            int min = java.time.Instant.ofEpochMilli(ts).atZone(ET).getMinute();
            int mins = hour * 60 + min;
            if (mins < 10 * 60) return "OPEN";
            if (mins < 11 * 60 + 30) return "MORNING";
            if (mins < 14 * 60) return "MIDDAY";
            return "POWER_HOUR";
        }

        private static String inferMaturity(double mfeR, boolean cont, boolean exhausted) {
            if (exhausted) return "EXHAUSTING_TREND";
            if (mfeR >= 2.5) return "PARABOLIC_EXPANSION";
            if (mfeR >= 1.2 && cont) return "HEALTHY_CONTINUATION";
            if (mfeR >= 0.5) return "EARLY_TREND";
            if (mfeR < 0.2) return "FAILED_TREND";
            return "EXTENDED_CONTINUATION";
        }

        private static String simplifyEvolution(String narrative) {
            if (narrative == null || narrative.isBlank()) return null;
            String n = narrative.replace(" ", "_").toUpperCase(Locale.US);
            if (n.length() > 80) n = n.substring(0, 80);
            return n.contains("→") ? n : n.replace(">", "→");
        }
    }
}
