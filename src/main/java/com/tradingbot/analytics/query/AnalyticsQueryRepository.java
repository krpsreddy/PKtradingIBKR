package com.tradingbot.analytics.query;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.analytics.query.model.AnalyticsSignalRow;
import com.tradingbot.analytics.storage.AnalyticsVersionService;
import com.tradingbot.analytics.storage.entity.DecisionFeedbackSnapshotEntity;
import com.tradingbot.analytics.storage.entity.EvaluatedSignalSnapshotEntity;
import com.tradingbot.analytics.storage.repository.DecisionFeedbackSnapshotRepository;
import com.tradingbot.analytics.storage.repository.EvaluatedSignalSnapshotRepository;
import com.tradingbot.intelligence.snapshot.AutonomousDisplayMapper;
import com.tradingbot.intelligence.snapshot.AutonomousSignalEnricher;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Loads and normalizes evaluated snapshots for analytics queries. */
@Repository
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnalyticsQueryRepository {

    private static final ZoneId ET = ZoneId.of("America/New_York");

    private final EvaluatedSignalSnapshotRepository snapshotRepository;
    private final DecisionFeedbackSnapshotRepository feedbackRepository;
    private final AnalyticsVersionService versionService;
    private final ObjectMapper objectMapper;
    private final AutonomousSignalEnricher autonomousEnricher;

    public List<AnalyticsSignalRow> loadRows(AnalyticsQueryFilter filter) {
        int version = versionService.currentVersion();
        Long fromTs = filter.fromDate() != null
                ? filter.fromDate().atStartOfDay(ET).toInstant().toEpochMilli() : null;
        Long toTs = filter.toDate() != null
                ? filter.toDate().plusDays(1).atStartOfDay(ET).toInstant().toEpochMilli() - 1 : null;

        Page<EvaluatedSignalSnapshotEntity> page = snapshotRepository.querySnapshots(
                filter.symbol(),
                fromTs,
                toTs,
                null,
                null,
                version,
                PageRequest.of(0, 10_000)
        );

        Map<String, DecisionFeedbackSnapshotEntity> feedback = preloadFeedback(page.getContent());

        List<AnalyticsSignalRow> rows = new ArrayList<>();
        for (EvaluatedSignalSnapshotEntity entity : page.getContent()) {
            AnalyticsSignalRow row = toRow(entity, feedback.get(entity.getSignalId()));
            if (filter.matches(row)) {
                rows.add(row);
            }
        }
        return rows;
    }

    public long countAll() {
        return snapshotRepository.countByAnalyticsVersion(versionService.currentVersion());
    }

    private Map<String, DecisionFeedbackSnapshotEntity> preloadFeedback(List<EvaluatedSignalSnapshotEntity> entities) {
        Map<String, DecisionFeedbackSnapshotEntity> map = new HashMap<>();
        for (EvaluatedSignalSnapshotEntity e : entities) {
            if (map.containsKey(e.getSignalId())) continue;
            feedbackRepository.findBySignalId(e.getSignalId()).ifPresent(f -> map.put(e.getSignalId(), f));
        }
        return map;
    }

    private AnalyticsSignalRow toRow(EvaluatedSignalSnapshotEntity e, DecisionFeedbackSnapshotEntity feedback) {
        JsonNode payload = readPayload(e.getPayload());
        int storedConviction = parseConviction(e.getConviction(), payload);
        AutonomousSignalEnricher.EnrichedSignal enriched = autonomousEnricher.enrich(e, 0);
        int conviction = enriched.convictionScore() > 0
                ? enriched.convictionScore()
                : storedConviction;
        double resultR = resolveResultR(e, payload);
        boolean winner = isWinner(e, resultR);
        boolean fakeout = Boolean.TRUE.equals(e.getFakeout())
                || (feedback != null && Boolean.TRUE.equals(feedback.getFalseTrap()));
        double continuation = e.getContinuationPercent() != null ? e.getContinuationPercent() : 0.0;
        double regret = feedback != null && feedback.getRegretScore() != null ? feedback.getRegretScore() : 0.0;
        boolean falseAvoid = feedback != null && Boolean.TRUE.equals(feedback.getFalseAvoid());
        boolean suppressedWinner = falseAvoid || (regret > 0.5 && resultR >= 2.0);
        String decision = AutonomousDisplayMapper.traderActionLabel(enriched.traderAction());
        String narrative = AutonomousDisplayMapper.opportunityLabel(enriched.opportunityType());
        String quality = firstNonBlank(enriched.entryQuality(),
                normalizeQuality(e.getEntryLocationQuality(), e.getExecutionQuality(), conviction, e.getFakeout()));

        return new AnalyticsSignalRow(
                e.getSignalId(),
                e.getSymbol(),
                decision,
                narrative,
                quality,
                classifyResult(e, resultR, fakeout),
                conviction,
                convictionBand(conviction),
                resultR,
                e.getMfe(),
                e.getMae(),
                continuation,
                fakeout,
                winner,
                e.getWinLoss(),
                regret,
                suppressedWinner,
                AutonomousDisplayMapper.isExecutableAction(decision)
        );
    }

    static String convictionBand(int conviction) {
        if (conviction >= 90) return "ELITE";
        if (conviction >= 75) return "HIGH";
        if (conviction >= 55) return "MODERATE";
        if (conviction >= 35) return "LOW";
        return "AVOID";
    }

    static String normalizeDecision(String decision, String setup, JsonNode payload) {
        String raw = firstNonBlank(decision, setup,
                payload != null ? payload.path("decision").asText(null) : null,
                payload != null ? payload.path("sourceSignalType").asText(null) : null);
        if (raw == null) return "UNKNOWN";
        String u = raw.toUpperCase(Locale.US);
        if (u.contains("FULL") || u.contains("EXECUTION") || u.contains("_BUY") || u.contains("ENTRY")) return "FULL_EXECUTION";
        if (u.contains("WAIT")) return "WAIT";
        if (u.contains("AVOID")) return "AVOID";
        if (u.contains("REDUCE")) return "REDUCE_SIZE";
        if (u.contains("TRAP") || u.contains("FAIL")) return "TRAP_RISK";
        if (u.contains("PROBE")) return "PROBING";
        return u.replace(' ', '_');
    }

    static boolean isFullExecution(String decision) {
        return "FULL_EXECUTION".equals(decision);
    }

    static String normalizeNarrative(String narrativePath, String setup, JsonNode payload) {
        String raw = firstNonBlank(narrativePath, setup,
                payload != null ? payload.path("signalType").asText(null) : null);
        if (raw == null) return "UNKNOWN";
        String u = raw.toUpperCase(Locale.US);
        if (u.contains("RECLAIM") || u.contains("PULL")) return "VWAP_RECLAIM";
        if (u.contains("SECOND") || u.contains("CONT")) return "SECOND_LEG";
        if (u.contains("FAIL") || u.contains("TRAP")) return "FAILED_BREAKOUT";
        if (u.contains("OPEN") || u.contains("MOM")) return "OPENING_DRIVE";
        if (u.contains("TREND")) return "TREND_CONTINUATION";
        return u.replace(' ', '_');
    }

    static String normalizeQuality(String entry, String execution, int conviction, Boolean fakeout) {
        String raw = firstNonBlank(entry, execution);
        if (raw != null) return raw.toUpperCase(Locale.US);
        if (Boolean.TRUE.equals(fakeout)) return "TRAP";
        if (conviction >= 80) return "INSTITUTIONAL";
        if (conviction >= 65) return "IDEAL";
        if (conviction < 40) return "EXHAUSTED";
        return "EXTENDED";
    }

    static String classifyResult(EvaluatedSignalSnapshotEntity e, double resultR, boolean fakeout) {
        if (fakeout || (e.getMae() != null && e.getMae() <= -1.0 && resultR < 0)) return "FAKEOUT";
        if (resultR >= 3.0) return "GT_3R";
        if (resultR >= 2.0) return "GT_2R";
        if ("WIN".equalsIgnoreCase(e.getWinLoss()) || resultR >= 0.5) {
            return resultR < 1.0 ? "SMALL_WIN" : "WINNER";
        }
        if (resultR <= -0.5 || "LOSS".equalsIgnoreCase(e.getWinLoss())) {
            if (e.getOutcomeAttribution() != null && e.getOutcomeAttribution().toUpperCase(Locale.US).contains("BREAK")) {
                return "BREAKDOWN_EXIT";
            }
            return "LOSER";
        }
        return "NEUTRAL";
    }

    private double resolveResultR(EvaluatedSignalSnapshotEntity e, JsonNode payload) {
        if (e.getMfe() != null) return e.getMfe();
        if (payload != null && payload.path("riskReward").isNumber()) return payload.path("riskReward").asDouble();
        if (payload != null && payload.path("evaluation").path("mfeR").isNumber()) {
            return payload.path("evaluation").path("mfeR").asDouble();
        }
        return 0.0;
    }

    private boolean isWinner(EvaluatedSignalSnapshotEntity e, double resultR) {
        return "WIN".equalsIgnoreCase(e.getWinLoss()) || resultR >= 0.5;
    }

    private int parseConviction(String stored, JsonNode payload) {
        if (stored != null && !stored.isBlank()) {
            try {
                return Integer.parseInt(stored.replaceAll("[^0-9]", ""));
            } catch (NumberFormatException ignored) {
                // fall through
            }
        }
        if (payload != null && payload.path("convictionScore").isNumber()) {
            return payload.path("convictionScore").asInt();
        }
        return 0;
    }

    private JsonNode readPayload(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            return null;
        }
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    public record AnalyticsQueryFilter(
            String symbol,
            LocalDate fromDate,
            LocalDate toDate,
            String decision,
            String narrative,
            String quality,
            String result,
            String convictionBand
    ) {
        public static AnalyticsQueryFilter from(
                String symbol, LocalDate from, LocalDate to,
                String decision, String narrative, String quality, String result, String convictionBand
        ) {
            return new AnalyticsQueryFilter(
                    symbol != null && !symbol.isBlank() ? symbol.toUpperCase(Locale.US) : null,
                    from, to,
                    blankToNull(decision), blankToNull(narrative), blankToNull(quality),
                    blankToNull(result), blankToNull(convictionBand)
            );
        }

        boolean matches(AnalyticsSignalRow row) {
            if (decision != null && !decision.equalsIgnoreCase(row.decision())) return false;
            if (narrative != null && !narrative.equalsIgnoreCase(row.narrative())) return false;
            if (quality != null && !quality.equalsIgnoreCase(row.quality())) return false;
            if (result != null && !result.equalsIgnoreCase(row.resultBucket())) return false;
            if (convictionBand != null && !convictionBand.equalsIgnoreCase(row.convictionBand())) return false;
            return true;
        }

        private static String blankToNull(String v) {
            return v == null || v.isBlank() || "ALL".equalsIgnoreCase(v) ? null : v;
        }
    }
}
