package com.tradingbot.executionreview;

import com.tradingbot.executionreview.ExecutionReviewDtos.*;
import com.tradingbot.models.ExecutionTelemetryRecord;
import com.tradingbot.models.OrchestrationTelemetryRecord;
import com.tradingbot.repository.ExecutionTelemetryRepository;
import com.tradingbot.repository.OrchestrationTelemetryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/** Phase 190 — post-market execution intelligence aggregation. */
@Service
@RequiredArgsConstructor
public class ExecutionReviewService {

    private static final ZoneId ET = ZoneId.of("America/New_York");
    private static final DateTimeFormatter SESSION_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final ExecutionTelemetryRepository telemetryRepo;
    private final OrchestrationTelemetryRepository orchestrationRepo;
    private final EntryQualityReviewEngine entryQuality;
    private final ExitQualityReviewEngine exitQuality;
    private final ContinuationCaptureEngine continuation;
    private final ExecutionNarrativeEngine narrative;

    public DailySummaryDto dailySummary(LocalDate sessionDate) {
        LocalDate day = sessionDate != null ? sessionDate : LocalDate.now(ET);
        List<ExecutionTelemetryRecord> sessionTrades = tradesForDay(day);
        List<ExecutionTelemetryRecord> closed = sessionTrades.stream()
                .filter(t -> t.getClosedAt() != null)
                .toList();
        int wins = (int) closed.stream().filter(t -> win(t)).count();
        double winRate = closed.isEmpty() ? 0 : (wins * 100.0 / closed.size());
        BigDecimal rSum = sumRealized(closed);
        BigDecimal expectancy = closed.isEmpty() ? BigDecimal.ZERO
                : rSum.divide(BigDecimal.valueOf(closed.size()), 4, RoundingMode.HALF_UP);
        BigDecimal avgR = expectancy;
        double contCap = continuation.aggregateCapturePct(closed);
        String best = bestRegime(closed, true);
        String worst = bestRegime(closed, false);
        double queueMiss = queueMissScore(day);

        long open = sessionTrades.stream().filter(t -> t.getClosedAt() == null).count();

        return new DailySummaryDto(
                sessionTrades.size(),
                closed.size(),
                (int) open,
                round1(winRate),
                rSum,
                expectancy,
                avgR,
                contCap,
                best,
                worst,
                queueMiss,
                day.toString()
        );
    }

    public TradesResponseDto trades(
            LocalDate sessionDate,
            String regime,
            String lifecycle,
            String outcome,
            String symbol,
            String sessionPeriod,
            String entryQualityFilter,
            String exitQualityFilter
    ) {
        List<ExecutionTelemetryRecord> raw = sessionDate != null
                ? tradesForDay(sessionDate)
                : telemetryRepo.findTop200ByClosedAtNotNullOrderByClosedAtDesc();

        List<TradeReviewDto> trades = raw.stream()
                .map(this::toTradeReview)
                .filter(t -> matchesFilter(t, regime, lifecycle, outcome, symbol, sessionPeriod,
                        entryQualityFilter, exitQualityFilter))
                .toList();

        return new TradesResponseDto(trades, new TradeFiltersDto(
                regime, lifecycle, outcome, symbol, sessionPeriod, entryQualityFilter, exitQualityFilter
        ));
    }

    public List<RegimePerformanceDto> regimePerformance(LocalDate sessionDate) {
        List<ExecutionTelemetryRecord> closed = closedForScope(sessionDate);
        Map<String, List<ExecutionTelemetryRecord>> byRegime = closed.stream()
                .collect(Collectors.groupingBy(t -> t.getRegime() != null ? t.getRegime() : "UNKNOWN",
                        LinkedHashMap::new, Collectors.toList()));

        return byRegime.entrySet().stream()
                .map(e -> regimeStats(e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(RegimePerformanceDto::tradeCount).reversed())
                .toList();
    }

    public List<ContinuationCaptureDto> continuationCapture(LocalDate sessionDate) {
        return closedForScope(sessionDate).stream()
                .map(continuation::analyze)
                .sorted(Comparator.comparing(ContinuationCaptureDto::capturePct).reversed())
                .toList();
    }

    public QueueAnalysisDto queueAnalysis(LocalDate sessionDate) {
        Instant[] range = dayRange(sessionDate != null ? sessionDate : LocalDate.now(ET));
        List<OrchestrationTelemetryRecord> orch = orchestrationRepo
                .findByRecordedAtBetweenOrderByRecordedAtDesc(range[0], range[1]);
        if (orch.isEmpty()) {
            orch = orchestrationRepo.findTop500ByOrderByRecordedAtDesc();
        }

        Map<String, ExecutionTelemetryRecord> closedBySymbol = closedForScope(sessionDate).stream()
                .collect(Collectors.toMap(
                        t -> t.getSymbol().toUpperCase(),
                        t -> t,
                        (a, b) -> a.getClosedAt() != null && b.getClosedAt() != null
                                && a.getClosedAt().isAfter(b.getClosedAt()) ? a : b
                ));

        List<QueueAnalysisItemDto> queued = new ArrayList<>();
        List<QueueAnalysisItemDto> suppressed = new ArrayList<>();
        List<QueueAnalysisItemDto> replacement = new ArrayList<>();
        int correctSuppress = 0;
        int queueBeatActive = 0;

        for (OrchestrationTelemetryRecord o : orch) {
            String state = o.getOrchestrationState() != null ? o.getOrchestrationState() : "";
            QueueAnalysisItemDto item = toQueueItem(o, closedBySymbol);
            if ("QUEUE".equals(state)) {
                queued.add(item);
                if ("OUTPERFORMED_ACTIVE".equals(item.verdict())) queueBeatActive++;
            } else if (state.startsWith("REJECTED")) {
                suppressed.add(item);
                if ("CORRECT_SUPPRESSION".equals(item.verdict())) correctSuppress++;
            } else if (Boolean.TRUE.equals(o.getReplacementAdvisory())
                    || "REPLACEMENT_CANDIDATE".equals(state)) {
                replacement.add(item);
            }
        }

        return new QueueAnalysisDto(
                queued.stream().limit(40).toList(),
                suppressed.stream().limit(40).toList(),
                replacement.stream().limit(20).toList(),
                correctSuppress,
                queueBeatActive
        );
    }

    public List<SessionAnalysisDto> sessionAnalysis(LocalDate sessionDate) {
        List<ExecutionTelemetryRecord> closed = closedForScope(sessionDate);
        Map<String, List<ExecutionTelemetryRecord>> bySession = closed.stream()
                .collect(Collectors.groupingBy(
                        t -> t.getSessionPeriod() != null ? t.getSessionPeriod() : "UNKNOWN",
                        LinkedHashMap::new,
                        Collectors.toList()));

        return bySession.entrySet().stream()
                .map(e -> {
                    List<ExecutionTelemetryRecord> list = e.getValue();
                    int wins = (int) list.stream().filter(this::win).count();
                    double winRate = list.isEmpty() ? 0 : wins * 100.0 / list.size();
                    BigDecimal avg = list.isEmpty() ? BigDecimal.ZERO
                            : sumRealized(list).divide(BigDecimal.valueOf(list.size()), 4, RoundingMode.HALF_UP);
                    return new SessionAnalysisDto(
                            e.getKey(),
                            list.size(),
                            round1(winRate),
                            avg,
                            continuation.aggregateCapturePct(list),
                            marketContextFor(e.getKey())
                    );
                })
                .toList();
    }

    private TradeReviewDto toTradeReview(ExecutionTelemetryRecord t) {
        String entryQ = entryQuality.classify(t);
        String exitQ = exitQuality.classify(t);
        double cap = continuation.analyze(t).capturePct();
        String outcome = outcome(t);
        return new TradeReviewDto(
                t.getId(),
                t.getPaperExecutionId(),
                t.getSymbol(),
                t.getRegime(),
                nz(t.getConviction()),
                nz(t.getDominance()),
                nz(t.getPersistence()),
                t.getLifecycle(),
                t.getExecutionQuality(),
                entryQ,
                exitQ,
                t.getMfeR(),
                t.getMaeR(),
                t.getRealizedR(),
                cap,
                t.getHoldDurationSec(),
                outcome,
                t.getExitReason(),
                t.getSessionPeriod(),
                t.getMarketRegime(),
                t.getOpenedAt() != null ? t.getOpenedAt().toEpochMilli() : 0,
                t.getClosedAt() != null ? t.getClosedAt().toEpochMilli() : null,
                narrative.build(t),
                buildTimeline(t),
                buildReplay(t)
        );
    }

    private List<TimelineEventDto> buildTimeline(ExecutionTelemetryRecord t) {
        List<TimelineEventDto> events = new ArrayList<>();
        long entryMs = t.getOpenedAt() != null ? t.getOpenedAt().toEpochMilli() : 0;
        long exitMs = t.getClosedAt() != null ? t.getClosedAt().toEpochMilli() : entryMs;

        events.add(event("ENTRY", entryMs, t, "Auto paper entry"));
        String lc = t.getLifecycle() != null ? t.getLifecycle().toUpperCase() : "CONFIRMED";
        long span = Math.max(60_000, exitMs - entryMs);
        String[] phases = timelinePhases(lc);
        for (int i = 0; i < phases.length; i++) {
            long ts = entryMs + (span * (i + 1) / (phases.length + 1));
            events.add(event(phases[i], ts, t, phaseNote(phases[i])));
        }
        if (t.getClosedAt() != null) {
            events.add(event("EXIT", exitMs, t, t.getExitReason() != null ? t.getExitReason() : "Close"));
        }
        return events;
    }

    private static String[] timelinePhases(String entryLifecycle) {
        return switch (entryLifecycle) {
            case "DEVELOPING" -> new String[]{"CONFIRMED", "PERSISTING", "EXIT_WARNING", "EXIT"};
            case "PERSISTING", "SECOND_LEG" -> new String[]{"PERSISTING", "SECOND_LEG", "EXIT_WARNING", "EXIT"};
            default -> new String[]{"CONFIRMED", "PERSISTING", "SECOND_LEG", "EXIT_WARNING"};
        };
    }

    private static TimelineEventDto event(String phase, long ts, ExecutionTelemetryRecord t, String note) {
        return new TimelineEventDto(
                phase,
                ts,
                t.getDominance(),
                t.getPersistence(),
                t.getVelocity(),
                t.getLifecycle(),
                note
        );
    }

    private static String phaseNote(String phase) {
        return switch (phase) {
            case "CONFIRMED" -> "Setup confirmed";
            case "PERSISTING" -> "Persistence holding";
            case "SECOND_LEG" -> "Second-leg expansion";
            case "EXIT_WARNING" -> "Exhaustion warning";
            case "EXIT" -> "Position closed";
            default -> phase;
        };
    }

    private ReplayLaunchDto buildReplay(ExecutionTelemetryRecord t) {
        String session = t.getOpenedAt() != null
                ? SESSION_FMT.format(t.getOpenedAt().atZone(ET))
                : LocalDate.now(ET).toString();
        long ts = t.getOpenedAt() != null ? t.getOpenedAt().toEpochMilli() : System.currentTimeMillis();
        String signalId = "paper-exec-" + (t.getPaperExecutionId() != null ? t.getPaperExecutionId() : t.getId());
        return new ReplayLaunchDto(signalId, t.getSymbol(), session, ts, 0);
    }

    private QueueAnalysisItemDto toQueueItem(
            OrchestrationTelemetryRecord o,
            Map<String, ExecutionTelemetryRecord> closedBySymbol
    ) {
        String active = o.getActiveSymbol() != null ? o.getActiveSymbol().toUpperCase() : "";
        String sym = o.getSymbol() != null ? o.getSymbol().toUpperCase() : "";
        ExecutionTelemetryRecord activeTrade = active.isBlank() ? null : closedBySymbol.get(active);
        ExecutionTelemetryRecord queuedTrade = closedBySymbol.get(sym);

        String verdict = "ADVISORY";
        String note = o.getReason() != null ? o.getReason() : "";
        BigDecimal delta = null;

        String state = o.getOrchestrationState() != null ? o.getOrchestrationState() : "";
        if ("QUEUE".equals(state) && activeTrade != null && queuedTrade != null) {
            double activeR = r(activeTrade);
            double queuedR = r(queuedTrade);
            delta = BigDecimal.valueOf(queuedR - activeR).setScale(2, RoundingMode.HALF_UP);
            if (queuedR > activeR + 0.3) {
                verdict = "OUTPERFORMED_ACTIVE";
                note = String.format("Queued %s outperformed active %s by %sR", sym, active, delta);
            } else if (queuedR < activeR - 0.3) {
                verdict = "UNDERPERFORMED_ACTIVE";
                note = String.format("Active %s beat queued %s by %sR", active, sym, delta.abs());
            }
        } else if (state.startsWith("REJECTED")) {
            if (queuedTrade != null && r(queuedTrade) < -0.2) {
                verdict = "CORRECT_SUPPRESSION";
                note = "Suppressed symbol would have lost after entry";
            } else if (queuedTrade != null && r(queuedTrade) > 0.5) {
                verdict = "MISSED_OPPORTUNITY";
                note = "Suppressed symbol would have worked";
            }
        }

        return new QueueAnalysisItemDto(
                sym,
                o.getRegime(),
                state,
                o.getReason(),
                active,
                nz(o.getDominance()),
                nz(o.getConviction()),
                o.getRecordedAt() != null ? o.getRecordedAt().toEpochMilli() : 0,
                verdict,
                note,
                delta
        );
    }

    private RegimePerformanceDto regimeStats(String regime, List<ExecutionTelemetryRecord> list) {
        int wins = (int) list.stream().filter(this::win).count();
        double winRate = list.isEmpty() ? 0 : wins * 100.0 / list.size();
        BigDecimal exp = list.isEmpty() ? BigDecimal.ZERO
                : sumRealized(list).divide(BigDecimal.valueOf(list.size()), 4, RoundingMode.HALF_UP);
        double avgHold = list.stream()
                .filter(t -> t.getHoldDurationSec() != null)
                .mapToInt(ExecutionTelemetryRecord::getHoldDurationSec)
                .average().orElse(0);
        double persistSurv = list.stream()
                .filter(t -> nz(t.getPersistence()) >= 60)
                .count() * 100.0 / Math.max(1, list.size());
        double secondLeg = list.stream()
                .filter(t -> "SECOND_LEG".equalsIgnoreCase(safe(t.getLifecycle()))
                        || "EXTENDED".equalsIgnoreCase(safe(t.getLifecycle())))
                .count() * 100.0 / Math.max(1, list.size());
        String bestSession = list.stream()
                .collect(Collectors.groupingBy(t -> t.getSessionPeriod() != null ? t.getSessionPeriod() : "UNKNOWN",
                        Collectors.averagingDouble(ExecutionReviewService::r)))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("—");

        return new RegimePerformanceDto(
                regime,
                list.size(),
                round1(winRate),
                exp,
                BigDecimal.valueOf(avgHold).setScale(0, RoundingMode.HALF_UP),
                continuation.aggregateCapturePct(list),
                round1(persistSurv),
                round1(secondLeg),
                bestSession
        );
    }

    private List<ExecutionTelemetryRecord> tradesForDay(LocalDate day) {
        LocalDate effective = day != null ? day : LocalDate.now(ET);
        Instant[] range = dayRange(effective);
        List<ExecutionTelemetryRecord> closed = telemetryRepo
                .findByClosedAtBetweenOrderByClosedAtDesc(range[0], range[1]);
        List<ExecutionTelemetryRecord> opened = telemetryRepo
                .findByOpenedAtBetweenOrderByOpenedAtDesc(range[0], range[1]);
        Map<Long, ExecutionTelemetryRecord> merged = new LinkedHashMap<>();
        for (ExecutionTelemetryRecord t : opened) merged.put(t.getId(), t);
        for (ExecutionTelemetryRecord t : closed) merged.put(t.getId(), t);
        return merged.values().stream()
                .sorted(Comparator.comparing(ExecutionTelemetryRecord::getOpenedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private List<ExecutionTelemetryRecord> closedForScope(LocalDate sessionDate) {
        if (sessionDate != null) {
            return tradesForDay(sessionDate).stream()
                    .filter(t -> t.getClosedAt() != null)
                    .toList();
        }
        return telemetryRepo.findTop200ByClosedAtNotNullOrderByClosedAtDesc();
    }

    private static Instant[] dayRange(LocalDate day) {
        ZonedDateTime start = day.atStartOfDay(ET);
        ZonedDateTime end = day.plusDays(1).atStartOfDay(ET);
        return new Instant[]{start.toInstant(), end.toInstant()};
    }

    private double queueMissScore(LocalDate sessionDate) {
        LocalDate day = sessionDate != null ? sessionDate : LocalDate.now(ET);
        QueueAnalysisDto q = queueAnalysis(day);
        int total = q.queuedVsActive().size() + q.suppressions().size();
        if (total == 0) return 0;
        return round1((q.queueOutperformedActive() * 100.0) / Math.max(1, q.queuedVsActive().size()));
    }

    private static String bestRegime(List<ExecutionTelemetryRecord> closed, boolean best) {
        return closed.stream()
                .collect(Collectors.groupingBy(
                        t -> t.getRegime() != null ? t.getRegime() : "UNKNOWN",
                        Collectors.averagingDouble(t -> t.getRealizedR() != null ? t.getRealizedR().doubleValue() : 0)))
                .entrySet().stream()
                .sorted(best
                        ? Map.Entry.<String, Double>comparingByValue().reversed()
                        : Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse("—");
    }

    private static boolean matchesFilter(
            TradeReviewDto t,
            String regime,
            String lifecycle,
            String outcome,
            String symbol,
            String sessionPeriod,
            String entryQ,
            String exitQ
    ) {
        if (regime != null && !regime.isBlank() && !regime.equalsIgnoreCase(t.regime())) return false;
        if (lifecycle != null && !lifecycle.isBlank()
                && (t.lifecycle() == null || !lifecycle.equalsIgnoreCase(t.lifecycle()))) return false;
        if (outcome != null && !outcome.isBlank() && !outcome.equalsIgnoreCase(t.outcome())) return false;
        if (symbol != null && !symbol.isBlank() && !symbol.equalsIgnoreCase(t.symbol())) return false;
        if (sessionPeriod != null && !sessionPeriod.isBlank()
                && (t.sessionPeriod() == null || !sessionPeriod.equalsIgnoreCase(t.sessionPeriod()))) return false;
        if (entryQ != null && !entryQ.isBlank() && !entryQ.equalsIgnoreCase(t.entryQuality())) return false;
        if (exitQ != null && !exitQ.isBlank() && !exitQ.equalsIgnoreCase(t.exitQuality())) return false;
        return true;
    }

    private boolean win(ExecutionTelemetryRecord t) {
        return t.getRealizedR() != null && t.getRealizedR().compareTo(BigDecimal.ZERO) > 0;
    }

    private String outcome(ExecutionTelemetryRecord t) {
        if (t.getClosedAt() == null) return "OPEN";
        if (t.getRealizedR() == null) return "FLAT";
        int cmp = t.getRealizedR().compareTo(BigDecimal.ZERO);
        if (cmp > 0) return "WIN";
        if (cmp < 0) return "LOSS";
        return "FLAT";
    }

    private static double r(ExecutionTelemetryRecord t) {
        return t.getRealizedR() != null ? t.getRealizedR().doubleValue() : 0;
    }

    private static BigDecimal sumRealized(List<ExecutionTelemetryRecord> list) {
        return list.stream()
                .map(ExecutionTelemetryRecord::getRealizedR)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }

    private static double round1(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private static String marketContextFor(String session) {
        return switch (session != null ? session.toUpperCase() : "") {
            case "OPENING_DRIVE", "OPEN" -> "Opening drive — momentum bias";
            case "MIDDAY", "MID_DAY" -> "Midday chop risk elevated";
            case "POWER_HOUR", "CLOSE" -> "Power hour continuation window";
            default -> "Session context from execution telemetry";
        };
    }
}
