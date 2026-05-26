package com.tradingbot.replay.cache;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.analytics.storage.AnalyticsVersionService;
import com.tradingbot.analytics.storage.entity.DecisionFeedbackSnapshotEntity;
import com.tradingbot.analytics.storage.entity.EvaluatedSignalSnapshotEntity;
import com.tradingbot.analytics.storage.repository.DecisionFeedbackSnapshotRepository;
import com.tradingbot.analytics.storage.repository.EvaluatedSignalSnapshotRepository;
import com.tradingbot.api.dto.CandleChartDto;
import com.tradingbot.api.dto.ReplayHistoryDto;
import com.tradingbot.api.dto.ReplaySignalEventDto;
import com.tradingbot.replay.cache.dto.ReplayCacheDtos.ReplaySignalIndexPageDto;
import com.tradingbot.replay.cache.dto.ReplayCacheDtos.ReplaySignalIndexRowDto;
import com.tradingbot.replay.cache.entity.ReplaySessionSnapshotEntity;
import com.tradingbot.replay.cache.repository.ReplaySessionSnapshotRepository;
import com.tradingbot.intelligence.snapshot.AutonomousSignalEnricher;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Phase 155 — compact cross-session signal index for execution review workstation. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReplaySignalIndexService {

    private static final ZoneId ET = ZoneId.of("America/New_York");
    private static final DateTimeFormatter ISO_TS = DateTimeFormatter.ISO_INSTANT;
    private static final TypeReference<List<ReplaySignalEventDto>> TIMELINE_TYPE = new TypeReference<>() {};

    private final EvaluatedSignalSnapshotRepository snapshotRepository;
    private final ReplaySessionSnapshotRepository replayRepository;
    private final DecisionFeedbackSnapshotRepository feedbackRepository;
    private final AnalyticsVersionService versionService;
    private final ObjectMapper objectMapper;
    private final AutonomousSignalEnricher autonomousEnricher;

    public ReplaySignalIndexPageDto index(
            String symbol,
            LocalDate from,
            LocalDate to,
            String decision,
            String narrative,
            String quality,
            String result,
            int page,
            int size
    ) {
        String sym = symbol != null ? symbol.toUpperCase(Locale.US) : null;
        if (sym == null || sym.isBlank()) {
            return empty(page, size);
        }

        int version = versionService.currentVersion();
        LocalDate fromDate = from != null ? from : LocalDate.now(ET).minusDays(60);
        LocalDate toDate = to != null ? to : LocalDate.now(ET);
        Long fromTs = fromDate.atStartOfDay(ET).toInstant().toEpochMilli();
        Long toTs = toDate.plusDays(1).atStartOfDay(ET).toInstant().toEpochMilli() - 1;

        Map<String, ReplaySignalIndexRowDto> byId = new LinkedHashMap<>();

        Page<EvaluatedSignalSnapshotEntity> evaluated = snapshotRepository.searchSignals(
                sym, fromTs, toTs, blankToNull(decision), version, PageRequest.of(0, 5000));
        Map<String, ReplaySessionSnapshotEntity> replayByKey = preloadReplaySnapshots(sym, evaluated.getContent());

        for (EvaluatedSignalSnapshotEntity entity : evaluated.getContent()) {
            ReplaySignalIndexRowDto row = fromEvaluated(entity, replayByKey);
            if (row != null && passesFilters(row, narrative, quality, result)) {
                byId.put(row.signalId(), row);
            }
        }

        // Phase 165 — skip legacy replay timeline rows; autonomous index uses evaluated snapshots only.
        // Timeline append duplicated MOM_READY / IMBALANCE_UP labels and capped conviction at rank score (~8).

        List<ReplaySignalIndexRowDto> sorted = new ArrayList<>(byId.values().stream()
                .sorted(Comparator
                        .comparingInt((ReplaySignalIndexRowDto r) -> r.conviction() != null ? r.conviction() : 0)
                        .reversed()
                        .thenComparing(Comparator.comparingLong(ReplaySignalIndexRowDto::timestamp).reversed()))
                .toList());

        enrichFeedback(sorted);

        int pageSize = Math.min(Math.max(size, 1), 1000);
        int fromIdx = Math.max(0, page) * pageSize;
        int toIdx = Math.min(sorted.size(), fromIdx + pageSize);
        List<ReplaySignalIndexRowDto> slice = fromIdx >= sorted.size()
                ? List.of()
                : sorted.subList(fromIdx, toIdx);

        return new ReplaySignalIndexPageDto(slice, sorted.size(), page, pageSize, System.currentTimeMillis(), version);
    }

    private void appendReplayTimelineRows(
            String sym,
            ReplaySessionSnapshotEntity snap,
            long fromTs,
            long toTs,
            Map<String, ReplaySignalIndexRowDto> byId,
            String decision,
            String narrative,
            String quality,
            String result
    ) {
        List<ReplaySignalEventDto> timeline = readTimeline(snap);
        if (timeline == null || timeline.isEmpty()) return;

        String sessionDate = snap.getSessionDate().toString();
        String snapshotId = String.valueOf(snap.getId());
        Map<Integer, Long> barTimes = loadBarTimes(snap.getReplayPayloadJson());

        for (ReplaySignalEventDto event : timeline) {
            if (event.getTimestamp() == null || event.getSignalType() == null) continue;
            long tsMs = parseMs(event.getTimestamp());
            if (tsMs < fromTs || tsMs > toTs) continue;

            String signalId = sym + "|" + sessionDate + "|" + tsMs + "|" + event.getSignalType();
            if (byId.containsKey(signalId)) continue;

            int candleIndex = resolveBarIndex(barTimes, tsMs);
            ReplaySignalIndexRowDto row = new ReplaySignalIndexRowDto(
                    signalId,
                    sym,
                    sessionDate,
                    tsMs,
                    ISO_TS.format(Instant.ofEpochMilli(tsMs)),
                    candleIndex,
                    candleIndex,
                    mapDecision(event.getSignalType(), event.getSetupLabel()),
                    mapSetup(event.getSignalType(), event.getSetupLabel()),
                    firstNonBlank(event.getSetupLabel(), event.getSignalType()),
                    event.getScore(),
                    mapEntryQuality(event),
                    null,
                    null,
                    null,
                    snap.getReplayPayloadJson() != null,
                    snapshotId,
                    null,
                    null,
                    List.of()
            );
            if (passesFilters(row, narrative, quality, result)
                    && (decision == null || decision.isBlank() || decision.equalsIgnoreCase(row.decision()))) {
                byId.put(signalId, row);
            }
        }
    }

    private ReplaySignalIndexRowDto fromEvaluated(
            EvaluatedSignalSnapshotEntity entity,
            Map<String, ReplaySessionSnapshotEntity> replayByKey
    ) {
        String sessionDate = entity.getSessionDate() != null
                ? entity.getSessionDate().toString()
                : LocalDate.ofInstant(Instant.ofEpochMilli(entity.getTimestampMs()), ET).toString();

        String replayKey = entity.getSymbol() + "|" + entity.getSessionDate();
        ReplaySessionSnapshotEntity replaySnap = replayByKey.get(replayKey);
        boolean replayReady = replaySnap != null && replaySnap.getReplayPayloadJson() != null;
        String snapshotId = replaySnap != null ? String.valueOf(replaySnap.getId()) : null;
        int candleIndex = replayReady
                ? resolveBarIndex(loadBarTimes(replaySnap.getReplayPayloadJson()), entity.getTimestampMs())
                : -1;

        Integer legacyConviction = parseConviction(entity.getConviction());
        AutonomousSignalEnricher.EnrichedSignal enriched = autonomousEnricher.enrich(entity, candleIndex);
        int conviction = enriched.convictionScore() > 0
                ? enriched.convictionScore()
                : (legacyConviction != null ? legacyConviction : 0);

        return new ReplaySignalIndexRowDto(
                entity.getSignalId(),
                entity.getSymbol(),
                sessionDate,
                entity.getTimestampMs(),
                ISO_TS.format(Instant.ofEpochMilli(entity.getTimestampMs())),
                candleIndex,
                candleIndex,
                enriched.traderAction(),
                enriched.opportunityType(),
                enriched.eventLabel(),
                conviction,
                enriched.entryQuality(),
                entity.getMfe(),
                entity.getMfe(),
                entity.getMae(),
                replayReady,
                snapshotId,
                entity.getWinLoss(),
                entity.getLifecycleState(),
                List.of()
        );
    }

    private void enrichFeedback(List<ReplaySignalIndexRowDto> rows) {
        if (rows.isEmpty()) return;
        Set<String> ids = rows.stream().map(ReplaySignalIndexRowDto::signalId).collect(Collectors.toSet());
        Map<String, DecisionFeedbackSnapshotEntity> feedback = new HashMap<>();
        for (String id : ids) {
            feedbackRepository.findBySignalId(id).ifPresent(f -> feedback.put(id, f));
        }
        if (feedback.isEmpty()) return;

        for (int i = 0; i < rows.size(); i++) {
            ReplaySignalIndexRowDto row = rows.get(i);
            DecisionFeedbackSnapshotEntity fb = feedback.get(row.signalId());
            if (fb == null) continue;
            rows.set(i, new ReplaySignalIndexRowDto(
                    row.signalId(),
                    row.symbol(),
                    row.sessionDate(),
                    row.timestamp(),
                    row.timestampIso(),
                    row.replayIndex(),
                    row.candleIndex(),
                    row.decision(),
                    row.setup(),
                    row.narrative(),
                    row.conviction(),
                    row.entryQuality(),
                    row.resultR(),
                    row.mfe(),
                    row.mae(),
                    row.replayReady(),
                    row.replaySnapshotId(),
                    fb.getActualOutcome() != null ? fb.getActualOutcome() : row.winLoss(),
                    row.lifecycleState(),
                    row.journeySteps()
            ));
        }
    }

    private Map<String, ReplaySessionSnapshotEntity> preloadReplaySnapshots(
            String symbol,
            List<EvaluatedSignalSnapshotEntity> rows
    ) {
        Map<String, ReplaySessionSnapshotEntity> map = new HashMap<>();
        for (EvaluatedSignalSnapshotEntity row : rows) {
            if (row.getSessionDate() == null) continue;
            String key = row.getSymbol() + "|" + row.getSessionDate();
            if (map.containsKey(key)) continue;
            replayRepository.findBySymbolAndSessionDate(symbol, row.getSessionDate())
                    .ifPresent(snap -> map.put(key, snap));
        }
        return map;
    }

    private List<ReplaySignalEventDto> readTimeline(ReplaySessionSnapshotEntity snap) {
        if (snap.getTimelineJson() != null && !snap.getTimelineJson().isBlank()) {
            try {
                return objectMapper.readValue(snap.getTimelineJson(), TIMELINE_TYPE);
            } catch (JsonProcessingException ignored) {
                // fall through
            }
        }
        try {
            ReplayHistoryDto history = objectMapper.readValue(snap.getReplayPayloadJson(), ReplayHistoryDto.class);
            return history.getTimeline();
        } catch (JsonProcessingException ex) {
            return List.of();
        }
    }

    private Map<Integer, Long> loadBarTimes(String replayJson) {
        Map<Integer, Long> map = new HashMap<>();
        if (replayJson == null || replayJson.isBlank()) return map;
        try {
            ReplayHistoryDto history = objectMapper.readValue(replayJson, ReplayHistoryDto.class);
            if (history.getSessionCandles() == null) return map;
            for (int i = 0; i < history.getSessionCandles().size(); i++) {
                CandleChartDto c = history.getSessionCandles().get(i);
                if (c.getTime() == null) continue;
                long ms = parseMs(c.getTime());
                if (ms >= 0) map.put(i, ms);
            }
        } catch (JsonProcessingException ignored) {
            // empty
        }
        return map;
    }

    private int resolveBarIndex(Map<Integer, Long> barTimes, long timestampMs) {
        if (barTimes.isEmpty()) return -1;
        int best = -1;
        long bestDelta = Long.MAX_VALUE;
        for (Map.Entry<Integer, Long> e : barTimes.entrySet()) {
            long delta = Math.abs(e.getValue() - timestampMs);
            if (delta < bestDelta) {
                bestDelta = delta;
                best = e.getKey();
            }
        }
        return best;
    }

    private boolean passesFilters(ReplaySignalIndexRowDto row, String narrative, String quality, String result) {
        return matchesNarrative(row, narrative)
                && matchesQuality(row, quality)
                && matchesResult(row, result);
    }

    private boolean matchesNarrative(ReplaySignalIndexRowDto row, String narrative) {
        if (narrative == null || narrative.isBlank()) return true;
        String needle = narrative.toLowerCase(Locale.US);
        String n = row.narrative() != null ? row.narrative().toLowerCase(Locale.US) : "";
        String s = row.setup() != null ? row.setup().toLowerCase(Locale.US) : "";
        return n.contains(needle) || s.contains(needle);
    }

    private boolean matchesQuality(ReplaySignalIndexRowDto row, String quality) {
        if (quality == null || quality.isBlank()) return true;
        return switch (quality.toUpperCase(Locale.US)) {
            case "ELITE" -> row.conviction() != null && row.conviction() >= 80;
            case "HIGH" -> row.conviction() != null && row.conviction() >= 70;
            case "IDEAL" -> "IDEAL".equalsIgnoreCase(row.entryQuality());
            case "INSTITUTIONAL" -> "INSTITUTIONAL".equalsIgnoreCase(row.entryQuality());
            case "EXTENDED" -> "EXTENDED".equalsIgnoreCase(row.entryQuality());
            case "TRAP" -> "TRAP".equalsIgnoreCase(row.entryQuality());
            default -> true;
        };
    }

    private boolean matchesResult(ReplaySignalIndexRowDto row, String result) {
        if (result == null || result.isBlank()) return true;
        return switch (result.toUpperCase(Locale.US)) {
            case "WINNERS" -> row.resultR() != null && row.resultR() > 0;
            case "LOSERS" -> row.resultR() != null && row.resultR() < 0;
            case "GT_2R" -> row.resultR() != null && row.resultR() >= 2.0;
            case "FAKEOUTS" -> row.resultR() != null && row.resultR() <= -1.0;
            case "TRAP_AVOIDED" -> "TRAP".equalsIgnoreCase(row.entryQuality());
            default -> true;
        };
    }

    private String mapDecision(String raw, String fallback) {
        String v = firstNonBlank(raw, fallback);
        if (v == null) return "WAIT";
        String u = v.toUpperCase(Locale.US);
        if (u.contains("EXIT")) return "EXIT";
        if (u.contains("STOP")) return "STOP";
        if (u.contains("TRAP") || u.contains("FAIL")) return "TRAP_RISK";
        if (u.contains("WAIT")) return "WAIT";
        if (u.contains("PROBE")) return "PROBING";
        if (u.contains("REDUCE")) return "REDUCE_SIZE";
        if (u.contains("BUY") || u.contains("EXEC") || u.contains("ENTRY")) return "FULL_EXECUTION";
        return u.replace(' ', '_');
    }

    private String mapSetup(String raw, String fallback) {
        String v = firstNonBlank(raw, fallback);
        if (v == null) return "TREND_CONTINUATION";
        String u = v.toUpperCase(Locale.US);
        if (u.contains("RECLAIM") || u.contains("PULL")) return "VWAP_RECLAIM";
        if (u.contains("SECOND") || u.contains("CONT")) return "SECOND_LEG";
        if (u.contains("OPEN") || u.contains("MOM")) return "OPEN_MOMENTUM";
        if (u.contains("FAIL") || u.contains("TRAP")) return "FAILED_BREAKOUT";
        return "TREND_CONTINUATION";
    }

    private String mapEntryQuality(ReplaySignalEventDto event) {
        if (event.getScore() != null && event.getScore() >= 80) return "INSTITUTIONAL";
        if (event.getSignalType() != null && event.getSignalType().contains("FAIL")) return "TRAP";
        if (Boolean.TRUE.equals(event.isExtended())) return "EXTENDED";
        return "IDEAL";
    }

    private String mapEntryQuality(String entryLocation, String execution, Integer conviction) {
        if (entryLocation != null && !entryLocation.isBlank()) return entryLocation.toUpperCase(Locale.US);
        if (execution != null && !execution.isBlank()) return execution.toUpperCase(Locale.US);
        if (conviction != null && conviction >= 80) return "INSTITUTIONAL";
        return "IDEAL";
    }

    private Integer parseConviction(String stored) {
        if (stored == null || stored.isBlank()) return null;
        try {
            return Integer.parseInt(stored.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private long parseMs(String time) {
        try {
            return Instant.parse(time).toEpochMilli();
        } catch (Exception ex) {
            try {
                return ZonedDateTime.parse(time).toInstant().toEpochMilli();
            } catch (Exception ignored) {
                return -1;
            }
        }
    }

    private ReplaySignalIndexPageDto empty(int page, int size) {
        return new ReplaySignalIndexPageDto(List.of(), 0, page, size, System.currentTimeMillis(), versionService.currentVersion());
    }
}
