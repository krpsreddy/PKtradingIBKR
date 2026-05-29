package com.tradingbot.discovery;

import com.tradingbot.decisiontrace.DecisionTraceRepository;
import com.tradingbot.executionreview.ContinuationCaptureEngine;
import com.tradingbot.executionreview.ExitQualityReviewEngine;
import com.tradingbot.livetrader.portfolio.CorrelationSuppressionEngine;
import com.tradingbot.models.*;
import com.tradingbot.refinement.ContinuationCaptureEfficiency;
import com.tradingbot.repository.BearishAssistTelemetryRepository;
import com.tradingbot.repository.ExecutionTelemetryRepository;
import com.tradingbot.repository.OrchestrationTelemetryRepository;
import com.tradingbot.repository.PaperExecutionRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Phase 203 — empirical 60-day regime intelligence from execution telemetry + decision traces.
 * Read-only analytics; does not modify live execution.
 */
@Service
@RequiredArgsConstructor
public class RegimeIntelligenceDiscoveryService {

    private static final ZoneId ET = ZoneId.of("America/New_York");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final ExecutionTelemetryRepository telemetryRepo;
    private final DecisionTraceRepository decisionTraceRepo;
    private final OrchestrationTelemetryRepository orchestrationRepo;
    private final BearishAssistTelemetryRepository bearishRepo;
    private final PaperExecutionRecordRepository paperRepo;
    private final ContinuationCaptureEngine continuationCapture;
    private final CorrelationSuppressionEngine sectorEngine;
    private final DiscoveryInsightsEngine insightsEngine;
    private final RegimeClusterArchitecture clusterArchitecture;

    private final Map<Integer, CachedReport> cache = new ConcurrentHashMap<>();

    public DiscoveryDtos.LookbackMetaDto meta(int days) {
        DiscoveryDataset ds = loadDataset(days);
        Instant from = DiscoveryLookback.fromInstant(days);
        return new DiscoveryDtos.LookbackMetaDto(
                DiscoveryLookback.normalizeDays(days),
                DATE_FMT.format(from.atZone(ET)),
                DATE_FMT.format(Instant.now().atZone(ET)),
                ds.closedTelemetry().size(),
                ds.decisionTraces().size()
        );
    }

    public List<DiscoveryDtos.RegimePerformanceRowDto> regimePerformance(int days) {
        return report(days).topRegimes();
    }

    public List<DiscoveryDtos.StructureFitCellDto> marketStructureFit(int days) {
        return report(days).marketStructureFit();
    }

    public List<DiscoveryDtos.EntryQualityRowDto> entryQuality(int days) {
        return report(days).entryQuality();
    }

    public List<DiscoveryDtos.ExitQualityRowDto> exitQuality(int days) {
        return report(days).exitQuality();
    }

    public List<DiscoveryDtos.ContinuationCaptureRowDto> continuationCapture(int days) {
        return report(days).continuationCapture();
    }

    public List<DiscoveryDtos.SessionRowDto> sessionAnalysis(int days) {
        return report(days).sessionAnalysis();
    }

    public List<DiscoveryDtos.SectorRowDto> sectorAnalysis(int days) {
        return report(days).sectorAnalysis();
    }

    public List<DiscoveryDtos.BearishAssistRowDto> bearishAnalysis(int days) {
        return report(days).bearishAnalysis();
    }

    public List<DiscoveryDtos.FailureClusterDto> failureClusters(int days) {
        return report(days).failureClusters();
    }

    public List<DiscoveryDtos.DecisionTraceInsightDto> decisionTraceAnalysis(int days) {
        return report(days).decisionTraceAnalysis();
    }

    public DiscoveryDtos.RegimeIntelligenceReportDto report(int days) {
        int norm = DiscoveryLookback.normalizeDays(days);
        long now = System.currentTimeMillis();
        CachedReport cached = cache.get(norm);
        if (cached != null && now - cached.loadedAtMs < 60_000) {
            return cached.report;
        }
        DiscoveryDataset ds = loadDataset(norm);
        DiscoveryDtos.RegimeIntelligenceReportDto built = buildReport(norm, ds);
        cache.put(norm, new CachedReport(built, now));
        return built;
    }

    private DiscoveryDtos.RegimeIntelligenceReportDto buildReport(int days, DiscoveryDataset ds) {
        List<ExecutionTelemetryRecord> closed = ds.closedTelemetry();
        DiscoveryDtos.LookbackMetaDto meta = new DiscoveryDtos.LookbackMetaDto(
                days,
                DATE_FMT.format(DiscoveryLookback.fromInstant(days).atZone(ET)),
                DATE_FMT.format(Instant.now().atZone(ET)),
                closed.size(),
                ds.decisionTraces().size()
        );

        var topRegimes = buildRegimePerformance(closed, ds);
        var structureFit = buildStructureFit(closed, ds);
        var entryQ = buildEntryQuality(closed, ds);
        var exitQ = buildExitQuality(closed, ds);
        var contCap = buildContinuationCapture(closed, ds);
        var sessions = buildSessionAnalysis(closed);
        var sectors = buildSectorAnalysis(closed);
        var bearish = buildBearishAnalysis(ds);
        var failures = buildFailureClusters(closed, ds);
        var traceInsights = buildDecisionTraceInsights(ds);
        var insights = insightsEngine.generate(
                closed.size(), topRegimes, entryQ, structureFit, exitQ, failures);

        return new DiscoveryDtos.RegimeIntelligenceReportDto(
                meta, topRegimes, structureFit, entryQ, exitQ, contCap, sessions, sectors,
                bearish, failures, traceInsights, clusterArchitecture.snapshot(), insights);
    }

    private List<DiscoveryDtos.RegimePerformanceRowDto> buildRegimePerformance(
            List<ExecutionTelemetryRecord> closed,
            DiscoveryDataset ds
    ) {
        return closed.stream()
                .collect(Collectors.groupingBy(t -> nz(t.getRegime())))
                .entrySet().stream()
                .map(e -> {
                    List<ExecutionTelemetryRecord> trades = e.getValue();
                    int n = trades.size();
                    int wins = (int) trades.stream().filter(this::win).count();
                    double capture = continuationCapture.aggregateCapturePct(trades);
                    BigDecimal avgR = avgRealized(trades);
                    BigDecimal avgHold = avgHold(trades);
                    double secondLeg = secondLegPct(trades, ds);
                    String bestEnv = bestStructureForRegime(trades, ds);
                    double failRate = n == 0 ? 0 : (n - wins) * 100.0 / n;
                    return new DiscoveryDtos.RegimePerformanceRowDto(
                            e.getKey(), n, round1(wins * 100.0 / Math.max(1, n)), avgR, capture,
                            avgHold, avgMfe(trades), avgMae(trades), secondLeg, bestEnv, round1(failRate));
                })
                .sorted(Comparator.comparingInt(DiscoveryDtos.RegimePerformanceRowDto::tradeCount).reversed())
                .toList();
    }

    private List<DiscoveryDtos.StructureFitCellDto> buildStructureFit(
            List<ExecutionTelemetryRecord> closed,
            DiscoveryDataset ds
    ) {
        List<DiscoveryDtos.StructureFitCellDto> cells = new ArrayList<>();
        for (ExecutionTelemetryRecord t : closed) {
            String regime = nz(t.getRegime());
            String structure = structureFor(t, ds);
            cells.add(new DiscoveryDtos.StructureFitCellDto(
                    regime, structure, 1, win(t) ? 100 : 0, t.getRealizedR(),
                    capturePct(t), ""));
        }
        Map<String, List<DiscoveryDtos.StructureFitCellDto>> grouped = cells.stream()
                .collect(Collectors.groupingBy(c -> c.regime() + "|" + c.marketStructure()));
        return grouped.values().stream()
                .map(list -> {
                    int n = list.size();
                    double wr = list.stream().mapToDouble(DiscoveryDtos.StructureFitCellDto::winRate).average().orElse(0);
                    BigDecimal avgR = list.stream()
                            .map(DiscoveryDtos.StructureFitCellDto::avgR)
                            .filter(Objects::nonNull)
                            .reduce(BigDecimal.ZERO, BigDecimal::add)
                            .divide(BigDecimal.valueOf(Math.max(1, n)), 4, RoundingMode.HALF_UP);
                    double cap = list.stream().mapToDouble(DiscoveryDtos.StructureFitCellDto::continuationCapturePct).average().orElse(0);
                    var first = list.get(0);
                    String verdict = cap >= 55 ? "STRONG" : cap >= 35 ? "MIXED" : "WEAK";
                    return new DiscoveryDtos.StructureFitCellDto(
                            first.regime(), first.marketStructure(), n, round1(wr), avgR, round1(cap), verdict);
                })
                .sorted(Comparator.comparing(DiscoveryDtos.StructureFitCellDto::continuationCapturePct).reversed())
                .limit(40)
                .toList();
    }

    private List<DiscoveryDtos.EntryQualityRowDto> buildEntryQuality(
            List<ExecutionTelemetryRecord> closed,
            DiscoveryDataset ds
    ) {
        return closed.stream()
                .collect(Collectors.groupingBy(t -> entryQualityFor(t, ds)))
                .entrySet().stream()
                .map(e -> {
                    List<ExecutionTelemetryRecord> trades = e.getValue();
                    int n = trades.size();
                    int wins = (int) trades.stream().filter(this::win).count();
                    return new DiscoveryDtos.EntryQualityRowDto(
                            e.getKey(), n, round1(wins * 100.0 / Math.max(1, n)),
                            avgRealized(trades), continuationCapture.aggregateCapturePct(trades),
                            persistenceSurvivalPct(trades), round1((n - wins) * 100.0 / Math.max(1, n)));
                })
                .sorted(Comparator.comparingInt(DiscoveryDtos.EntryQualityRowDto::tradeCount).reversed())
                .toList();
    }

    private List<DiscoveryDtos.ExitQualityRowDto> buildExitQuality(
            List<ExecutionTelemetryRecord> closed,
            DiscoveryDataset ds
    ) {
        return closed.stream()
                .collect(Collectors.groupingBy(t -> exitTypeFor(t, ds)))
                .entrySet().stream()
                .map(e -> {
                    List<ExecutionTelemetryRecord> trades = e.getValue();
                    int n = trades.size();
                    double premature = trades.stream().filter(this::prematureExit).count() * 100.0 / Math.max(1, n);
                    double holdEff = trades.stream().mapToDouble(this::holdEfficiency).average().orElse(0);
                    return new DiscoveryDtos.ExitQualityRowDto(
                            e.getKey(), n, continuationCapture.aggregateCapturePct(trades),
                            avgRealized(trades), round1(premature), round1(holdEff));
                })
                .sorted(Comparator.comparingInt(DiscoveryDtos.ExitQualityRowDto::tradeCount).reversed())
                .toList();
    }

    private List<DiscoveryDtos.ContinuationCaptureRowDto> buildContinuationCapture(
            List<ExecutionTelemetryRecord> closed,
            DiscoveryDataset ds
    ) {
        List<DiscoveryDtos.ContinuationCaptureRowDto> rows = new ArrayList<>();
        rows.addAll(bucketCapture("regime", closed, t -> nz(t.getRegime())));
        rows.addAll(bucketCapture("market_structure", closed, t -> structureFor(t, ds)));
        rows.addAll(bucketCapture("session", closed, t -> sessionBucket(t)));
        rows.addAll(bucketCapture("entry_quality", closed, t -> entryQualityFor(t, ds)));
        rows.addAll(bucketCapture("exit_type", closed, t -> exitTypeFor(t, ds)));
        return rows.stream()
                .sorted(Comparator.comparingDouble(DiscoveryDtos.ContinuationCaptureRowDto::continuationCapturePct).reversed())
                .limit(60)
                .toList();
    }

    private List<DiscoveryDtos.ContinuationCaptureRowDto> bucketCapture(
            String dimension,
            List<ExecutionTelemetryRecord> closed,
            java.util.function.Function<ExecutionTelemetryRecord, String> keyFn
    ) {
        return closed.stream()
                .collect(Collectors.groupingBy(keyFn))
                .entrySet().stream()
                .map(e -> new DiscoveryDtos.ContinuationCaptureRowDto(
                        dimension, e.getKey(), e.getValue().size(),
                        continuationCapture.aggregateCapturePct(e.getValue()),
                        avgRealized(e.getValue())))
                .filter(r -> r.tradeCount() >= 1)
                .toList();
    }

    private List<DiscoveryDtos.SessionRowDto> buildSessionAnalysis(List<ExecutionTelemetryRecord> closed) {
        return closed.stream()
                .collect(Collectors.groupingBy(this::sessionBucket))
                .entrySet().stream()
                .map(e -> {
                    List<ExecutionTelemetryRecord> trades = e.getValue();
                    int n = trades.size();
                    int wins = (int) trades.stream().filter(this::win).count();
                    String topRegime = trades.stream()
                            .collect(Collectors.groupingBy(t -> nz(t.getRegime()), Collectors.counting()))
                            .entrySet().stream()
                            .max(Map.Entry.comparingByValue())
                            .map(Map.Entry::getKey)
                            .orElse("—");
                    return new DiscoveryDtos.SessionRowDto(
                            e.getKey(), n, round1(wins * 100.0 / Math.max(1, n)),
                            avgRealized(trades), continuationCapture.aggregateCapturePct(trades), topRegime);
                })
                .sorted(Comparator.comparingInt(DiscoveryDtos.SessionRowDto::tradeCount).reversed())
                .toList();
    }

    private List<DiscoveryDtos.SectorRowDto> buildSectorAnalysis(List<ExecutionTelemetryRecord> closed) {
        return closed.stream()
                .collect(Collectors.groupingBy(t -> sectorEngine.clusterFor(t.getSymbol())))
                .entrySet().stream()
                .map(e -> {
                    List<ExecutionTelemetryRecord> trades = e.getValue();
                    int n = trades.size();
                    int wins = (int) trades.stream().filter(this::win).count();
                    String topRegime = trades.stream()
                            .collect(Collectors.groupingBy(t -> nz(t.getRegime()), Collectors.counting()))
                            .entrySet().stream()
                            .max(Map.Entry.comparingByValue())
                            .map(Map.Entry::getKey)
                            .orElse("—");
                    return new DiscoveryDtos.SectorRowDto(
                            e.getKey(), n, round1(wins * 100.0 / Math.max(1, n)),
                            avgRealized(trades), continuationCapture.aggregateCapturePct(trades), topRegime);
                })
                .sorted(Comparator.comparingInt(DiscoveryDtos.SectorRowDto::tradeCount).reversed())
                .toList();
    }

    private List<DiscoveryDtos.BearishAssistRowDto> buildBearishAnalysis(DiscoveryDataset ds) {
        Map<String, List<BearishAssistTelemetryRecord>> byState = ds.bearishTriggers().stream()
                .collect(Collectors.groupingBy(b -> nz(b.getBearishState())));
        List<DiscoveryDtos.BearishAssistRowDto> rows = new ArrayList<>();
        for (var e : byState.entrySet()) {
            List<BearishAssistTelemetryRecord> list = e.getValue();
            double avgBias = list.stream()
                    .mapToInt(b -> b.getBearishBias() != null ? b.getBearishBias() : 0)
                    .average().orElse(0);
            rows.add(new DiscoveryDtos.BearishAssistRowDto(
                    e.getKey(), list.size(), round1(avgBias), 0, 0,
                    "PUT assist triggers — follow-through tracked in future phases"));
        }
        ds.decisionTraces().stream()
                .filter(d -> "PUT_ASSIST".equals(d.getDecisionType()))
                .collect(Collectors.groupingBy(d -> nz(d.getLifecycle())))
                .forEach((state, traces) -> rows.add(new DiscoveryDtos.BearishAssistRowDto(
                        state, traces.size(), traces.stream()
                                .mapToInt(d -> d.getConviction() != null ? d.getConviction() : 0)
                                .average().orElse(0),
                        0, 0, "From decision_trace PUT_ASSIST")));
        return rows.stream()
                .sorted(Comparator.comparingInt(DiscoveryDtos.BearishAssistRowDto::triggerCount).reversed())
                .limit(20)
                .toList();
    }

    private List<DiscoveryDtos.FailureClusterDto> buildFailureClusters(
            List<ExecutionTelemetryRecord> closed,
            DiscoveryDataset ds
    ) {
        List<ExecutionTelemetryRecord> losses = closed.stream()
                .filter(t -> !win(t))
                .toList();
        if (losses.isEmpty()) return List.of();

        Map<String, List<ExecutionTelemetryRecord>> clusters = losses.stream()
                .collect(Collectors.groupingBy(t -> failureKey(t, ds)));

        int totalLosses = losses.size();
        return clusters.entrySet().stream()
                .map(e -> {
                    List<ExecutionTelemetryRecord> list = e.getValue();
                    BigDecimal avgLoss = avgRealized(list);
                    double share = list.size() * 100.0 / totalLosses;
                    return new DiscoveryDtos.FailureClusterDto(
                            e.getKey(), list.size(), avgLoss != null ? avgLoss.doubleValue() : 0,
                            round1(share), parseConditions(e.getKey()));
                })
                .sorted(Comparator.comparingInt(DiscoveryDtos.FailureClusterDto::lossCount).reversed())
                .limit(15)
                .toList();
    }

    private List<DiscoveryDtos.DecisionTraceInsightDto> buildDecisionTraceInsights(DiscoveryDataset ds) {
        List<DiscoveryDtos.DecisionTraceInsightDto> out = new ArrayList<>();
        ds.decisionTraces().stream()
                .collect(Collectors.groupingBy(d -> nz(d.getDecisionType())))
                .forEach((type, list) -> out.add(new DiscoveryDtos.DecisionTraceInsightDto(
                        type, list.size(), 0,
                        summarizeTraces(type, list))));
        ds.decisionTraces().stream()
                .filter(d -> d.getRejectionCategory() != null)
                .collect(Collectors.groupingBy(DecisionTraceRecord::getRejectionCategory))
                .forEach((cat, list) -> out.add(new DiscoveryDtos.DecisionTraceInsightDto(
                        "REJECTION:" + cat, list.size(), 0,
                        list.size() + " suppression/rejection events in window")));
        return out.stream()
                .sorted(Comparator.comparingInt(DiscoveryDtos.DecisionTraceInsightDto::count).reversed())
                .limit(25)
                .toList();
    }

    private DiscoveryDataset loadDataset(int days) {
        Instant from = DiscoveryLookback.fromInstant(days);
        Instant to = Instant.now();

        List<ExecutionTelemetryRecord> closed = telemetryRepo.findByClosedAtBetweenOrderByClosedAtDesc(from, to);
        if (closed.isEmpty()) {
            closed = telemetryRepo.findTop200ByClosedAtNotNullOrderByClosedAtDesc().stream()
                    .filter(t -> t.getClosedAt() != null && !t.getClosedAt().isBefore(from))
                    .toList();
        }

        List<DecisionTraceRecord> traces = decisionTraceRepo.findByRecordedAtBetweenOrderByRecordedAtDesc(from, to);
        List<OrchestrationTelemetryRecord> orch = orchestrationRepo
                .findByRecordedAtBetweenOrderByRecordedAtDesc(from, to);
        List<BearishAssistTelemetryRecord> bearish = bearishRepo
                .findByRecordedAtBetweenOrderByRecordedAtDesc(from, to);

        Map<Long, PaperExecutionRecord> paperById = new HashMap<>();
        Map<Long, String> entryQ = new HashMap<>();
        Map<Long, String> structure = new HashMap<>();
        Map<Long, String> exitType = new HashMap<>();

        for (ExecutionTelemetryRecord t : closed) {
            if (t.getPaperExecutionId() != null) {
                paperRepo.findById(t.getPaperExecutionId()).ifPresent(p -> paperById.put(p.getId(), p));
            }
        }
        for (DecisionTraceRecord d : traces) {
            Long pid = d.getPaperExecutionId();
            if (pid == null) continue;
            if ("ENTRY".equals(d.getDecisionType()) && d.getEntryQuality() != null) {
                entryQ.put(pid, d.getEntryQuality());
            }
            if (d.getMarketStructure() != null) {
                structure.put(pid, primaryStructure(d.getMarketStructure()));
            }
            if ("EXIT".equals(d.getDecisionType()) && d.getExitState() != null) {
                exitType.put(pid, d.getExitState());
            }
        }

        return new DiscoveryDataset(days, closed, traces, orch, bearish, paperById, entryQ, structure, exitType);
    }

    private String entryQualityFor(ExecutionTelemetryRecord t, DiscoveryDataset ds) {
        if (t.getPaperExecutionId() != null && ds.entryQualityByPaperId().containsKey(t.getPaperExecutionId())) {
            return ds.entryQualityByPaperId().get(t.getPaperExecutionId());
        }
        return t.getExecutionQuality() != null ? t.getExecutionQuality() : "UNKNOWN";
    }

    private String structureFor(ExecutionTelemetryRecord t, DiscoveryDataset ds) {
        if (t.getPaperExecutionId() != null && ds.structureByPaperId().containsKey(t.getPaperExecutionId())) {
            return ds.structureByPaperId().get(t.getPaperExecutionId());
        }
        if (t.getMarketRegime() != null) return primaryStructure(t.getMarketRegime());
        return "UNKNOWN";
    }

    private String exitTypeFor(ExecutionTelemetryRecord t, DiscoveryDataset ds) {
        if (t.getPaperExecutionId() != null && ds.exitTypeByPaperId().containsKey(t.getPaperExecutionId())) {
            return ds.exitTypeByPaperId().get(t.getPaperExecutionId());
        }
        if (t.getExitReason() != null) {
            String r = t.getExitReason().toUpperCase();
            if (r.contains("VWAP")) return "VWAP_FAILURE";
            if (r.contains("EXHAUST")) return "EXHAUSTION_EXIT";
            if (r.contains("PERSIST")) return "PERSISTENCE_FAILURE";
        }
        return "ADAPTIVE";
    }

    private static String primaryStructure(String raw) {
        if (raw == null) return "UNKNOWN";
        int bracket = raw.indexOf('[');
        return bracket > 0 ? raw.substring(0, bracket).trim() : raw.trim();
    }

    private String failureKey(ExecutionTelemetryRecord t, DiscoveryDataset ds) {
        return structureFor(t, ds) + " + " + entryQualityFor(t, ds) + " + " + sessionBucket(t)
                + (t.getRvol() != null && t.getRvol().doubleValue() < 1.2 ? " + LOW_RVOL" : "");
    }

    private static List<String> parseConditions(String key) {
        return Arrays.stream(key.split("\\+")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private String sessionBucket(ExecutionTelemetryRecord t) {
        if (t.getSessionPeriod() != null && !t.getSessionPeriod().isBlank()) {
            return t.getSessionPeriod().toUpperCase();
        }
        if (t.getOpenedAt() == null) return "UNKNOWN";
        int hour = t.getOpenedAt().atZone(ET).getHour();
        int minute = t.getOpenedAt().atZone(ET).getMinute();
        int mins = hour * 60 + minute;
        if (mins < 10 * 60) return "OPENING_DRIVE";
        if (mins < 11 * 60 + 30) return "MORNING_CONTINUATION";
        if (mins < 14 * 60) return "MIDDAY";
        return "POWER_HOUR";
    }

    private String bestStructureForRegime(List<ExecutionTelemetryRecord> trades, DiscoveryDataset ds) {
        return trades.stream()
                .collect(Collectors.groupingBy(t -> structureFor(t, ds),
                        Collectors.averagingDouble(this::capturePct)))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("—");
    }

    private double secondLegPct(List<ExecutionTelemetryRecord> trades, DiscoveryDataset ds) {
        long hit = trades.stream()
                .filter(t -> t.getPaperExecutionId() != null)
                .filter(t -> {
                    PaperExecutionRecord p = ds.paperById().get(t.getPaperExecutionId());
                    return p != null && Boolean.TRUE.equals(p.getSecondLegCaptured());
                })
                .count();
        return trades.isEmpty() ? 0 : round1(hit * 100.0 / trades.size());
    }

    private double persistenceSurvivalPct(List<ExecutionTelemetryRecord> trades) {
        long ok = trades.stream()
                .filter(t -> t.getPersistence() != null && t.getPersistence() >= 45)
                .filter(this::win)
                .count();
        return trades.isEmpty() ? 0 : round1(ok * 100.0 / trades.size());
    }

    private boolean prematureExit(ExecutionTelemetryRecord t) {
        double cap = capturePct(t);
        return t.getMfeR() != null && t.getRealizedR() != null
                && t.getMfeR().subtract(t.getRealizedR()).compareTo(new BigDecimal("0.35")) > 0
                && cap < 45;
    }

    private double holdEfficiency(ExecutionTelemetryRecord t) {
        if (t.getHoldDurationSec() == null || t.getHoldDurationSec() <= 0) return 50;
        double cap = capturePct(t);
        return Math.min(100, cap * 1.2);
    }

    private double capturePct(ExecutionTelemetryRecord t) {
        return ContinuationCaptureEfficiency.fromTelemetry(t) * 100;
    }

    private boolean win(ExecutionTelemetryRecord t) {
        return t.getRealizedR() != null && t.getRealizedR().compareTo(BigDecimal.ZERO) > 0;
    }

    private static BigDecimal avgRealized(List<ExecutionTelemetryRecord> trades) {
        return trades.stream()
                .map(ExecutionTelemetryRecord::getRealizedR)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(Math.max(1, trades.size())), 4, RoundingMode.HALF_UP);
    }

    private static BigDecimal avgHold(List<ExecutionTelemetryRecord> trades) {
        return BigDecimal.valueOf(trades.stream()
                .map(ExecutionTelemetryRecord::getHoldDurationSec)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0)).setScale(0, RoundingMode.HALF_UP);
    }

    private static BigDecimal avgMfe(List<ExecutionTelemetryRecord> trades) {
        return trades.stream()
                .map(ExecutionTelemetryRecord::getMfeR)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(Math.max(1, trades.size())), 4, RoundingMode.HALF_UP);
    }

    private static BigDecimal avgMae(List<ExecutionTelemetryRecord> trades) {
        return trades.stream()
                .map(ExecutionTelemetryRecord::getMaeR)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(Math.max(1, trades.size())), 4, RoundingMode.HALF_UP);
    }

    private static String nz(String s) {
        return s == null || s.isBlank() ? "UNKNOWN" : s;
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    private static String summarizeTraces(String type, List<DecisionTraceRecord> list) {
        long withNarrative = list.stream().filter(d -> d.getNarrative() != null && !d.getNarrative().isBlank()).count();
        return type + " traces: " + list.size() + " (" + withNarrative + " with narratives)";
    }

    private record CachedReport(DiscoveryDtos.RegimeIntelligenceReportDto report, long loadedAtMs) {}
}
