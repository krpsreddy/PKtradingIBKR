package com.tradingbot.analytics.storage;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.analytics.storage.dto.AnalyticsStorageDtos.HistoricalSignalSearchPageDto;
import com.tradingbot.analytics.storage.dto.AnalyticsStorageDtos.HistoricalSignalSearchResultDto;
import com.tradingbot.analytics.storage.entity.EvaluatedSignalSnapshotEntity;
import com.tradingbot.analytics.storage.repository.EvaluatedSignalSnapshotRepository;
import com.tradingbot.api.dto.CandleChartDto;
import com.tradingbot.api.dto.ReplayHistoryDto;
import com.tradingbot.api.dto.ReplaySignalEventDto;
import com.tradingbot.intelligence.snapshot.AutonomousDisplayMapper;
import com.tradingbot.intelligence.snapshot.AutonomousSignalEnricher;
import com.tradingbot.replay.cache.entity.ReplaySessionSnapshotEntity;
import com.tradingbot.replay.cache.repository.ReplaySessionSnapshotRepository;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Phase 153 — indexed historical signal search with replay cache enrichment. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HistoricalSignalSearchService {

    private static final ZoneId ET = ZoneId.of("America/New_York");
    private static final DateTimeFormatter ISO_TS = DateTimeFormatter.ISO_INSTANT;

    private final EvaluatedSignalSnapshotRepository snapshotRepository;
    private final ReplaySessionSnapshotRepository replayRepository;
    private final AnalyticsVersionService versionService;
    private final ObjectMapper objectMapper;
    private final AutonomousSignalEnricher autonomousEnricher;

    public HistoricalSignalSearchPageDto search(
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
        int version = versionService.currentVersion();
        Long fromTs = from != null ? from.atStartOfDay(ET).toInstant().toEpochMilli() : null;
        Long toTs = to != null ? to.plusDays(1).atStartOfDay(ET).toInstant().toEpochMilli() - 1 : null;

        Page<EvaluatedSignalSnapshotEntity> raw = snapshotRepository.searchSignals(
                symbol != null ? symbol.toUpperCase() : null,
                fromTs,
                toTs,
                blankToNull(decision),
                version,
                PageRequest.of(page, Math.min(size, 1000))
        );

        Map<String, ReplaySessionSnapshotEntity> replayByKey = preloadReplaySnapshots(symbol, raw.getContent());

        List<HistoricalSignalSearchResultDto> signals = new ArrayList<>();
        for (EvaluatedSignalSnapshotEntity entity : raw.getContent()) {
            HistoricalSignalSearchResultDto dto = toResult(entity, replayByKey);
            if (matchesNarrative(dto, narrative)
                    && matchesQuality(dto, quality)
                    && matchesResult(dto, entity, result)) {
                signals.add(dto);
            }
        }

        if (signals.isEmpty() && symbol != null && !symbol.isBlank()) {
            signals.addAll(searchReplayCacheFallback(
                    symbol.toUpperCase(), from, to, decision, narrative, quality, result, Math.min(size, 1000)));
        }

        return new HistoricalSignalSearchPageDto(
                signals,
                page,
                size,
                signals.isEmpty() ? raw.getTotalElements() : signals.size(),
                version
        );
    }

    private Map<String, ReplaySessionSnapshotEntity> preloadReplaySnapshots(
            String symbolFilter,
            List<EvaluatedSignalSnapshotEntity> rows
    ) {
        Map<String, ReplaySessionSnapshotEntity> map = new HashMap<>();
        for (EvaluatedSignalSnapshotEntity row : rows) {
            if (row.getSessionDate() == null) continue;
            String key = row.getSymbol() + "|" + row.getSessionDate();
            if (map.containsKey(key)) continue;
            replayRepository.findBySymbolAndSessionDate(row.getSymbol(), row.getSessionDate())
                    .ifPresent(snap -> map.put(key, snap));
        }
        return map;
    }

    private HistoricalSignalSearchResultDto toResult(
            EvaluatedSignalSnapshotEntity entity,
            Map<String, ReplaySessionSnapshotEntity> replayByKey
    ) {
        JsonNode payload = readPayload(entity.getPayload());
        JsonNode eval = payload != null ? payload.path("evaluation") : null;

        String sessionDate = entity.getSessionDate() != null
                ? entity.getSessionDate().toString()
                : LocalDate.ofInstant(Instant.ofEpochMilli(entity.getTimestampMs()), ET).toString();

        int replayIndex = -1;
        String replayKey = entity.getSymbol() + "|" + entity.getSessionDate();
        ReplaySessionSnapshotEntity replaySnapEarly = replayByKey.get(replayKey);
        if (replaySnapEarly != null && replaySnapEarly.getReplayPayloadJson() != null) {
            replayIndex = resolveBarIndex(replaySnapEarly.getReplayPayloadJson(), entity.getTimestampMs());
        }

        AutonomousSignalEnricher.EnrichedSignal enriched = autonomousEnricher.enrich(entity, Math.max(0, replayIndex));
        String decision = AutonomousDisplayMapper.traderActionLabel(enriched.traderAction());
        String narrative = AutonomousDisplayMapper.opportunityLabel(enriched.opportunityType());

        Integer storedConviction = parseConviction(entity.getConviction(), payload);
        int conviction = enriched.convictionScore() > 0
                ? enriched.convictionScore()
                : (storedConviction != null ? storedConviction : 0);
        Double expectancy = payload != null && payload.path("riskReward").isNumber()
                ? payload.path("riskReward").asDouble()
                : entity.getMfe();
        Double actualR = entity.getMfe();
        if (actualR == null && eval != null && eval.path("mfeR").isNumber()) {
            actualR = eval.path("mfeR").asDouble();
        }

        Double fakeoutRisk = payload != null && payload.path("fakeoutProbability").isNumber()
                ? payload.path("fakeoutProbability").asDouble()
                : (entity.getFakeout() != null && entity.getFakeout() ? 1.0 : null);

        String entryQuality = firstNonBlank(
                enriched.entryQuality(),
                entity.getEntryLocationQuality(),
                entity.getExecutionQuality(),
                conviction >= 80 ? "INSTITUTIONAL" : null
        );

        ReplaySessionSnapshotEntity replaySnap = replaySnapEarly;
        boolean replayReady = replaySnap != null && replaySnap.getReplayPayloadJson() != null;
        String snapshotId = replaySnap != null ? String.valueOf(replaySnap.getId()) : null;
        if (replayReady && replayIndex < 0) {
            replayIndex = resolveBarIndex(replaySnap.getReplayPayloadJson(), entity.getTimestampMs());
        }

        return new HistoricalSignalSearchResultDto(
                entity.getSignalId(),
                entity.getSymbol(),
                sessionDate,
                ISO_TS.format(Instant.ofEpochMilli(entity.getTimestampMs())),
                entity.getTimestampMs(),
                decision,
                narrative,
                conviction,
                expectancy,
                actualR,
                fakeoutRisk,
                entryQuality,
                replayReady,
                replayIndex,
                snapshotId
        );
    }

    private int resolveBarIndex(String replayJson, long timestampMs) {
        if (replayJson == null || replayJson.isBlank()) return -1;
        try {
            ReplayHistoryDto history = objectMapper.readValue(replayJson, ReplayHistoryDto.class);
            if (history.getSessionCandles() == null || history.getSessionCandles().isEmpty()) return -1;
            int best = -1;
            long bestDelta = Long.MAX_VALUE;
            for (int i = 0; i < history.getSessionCandles().size(); i++) {
                CandleChartDto c = history.getSessionCandles().get(i);
                if (c.getTime() == null) continue;
                long ms = parseCandleMs(c.getTime());
                if (ms < 0) continue;
                long delta = Math.abs(ms - timestampMs);
                if (delta < bestDelta) {
                    bestDelta = delta;
                    best = i;
                }
            }
            return best;
        } catch (Exception ex) {
            return -1;
        }
    }

    private List<HistoricalSignalSearchResultDto> searchReplayCacheFallback(
            String symbol,
            LocalDate from,
            LocalDate to,
            String decision,
            String narrative,
            String quality,
            String result,
            int limit
    ) {
        LocalDate cutoff = from != null ? from : LocalDate.now(ET).minusDays(60);
        List<ReplaySessionSnapshotEntity> snapshots = replayRepository
                .findBySymbolAndSessionDateGreaterThanEqualOrderBySessionDateAsc(symbol, cutoff);

        List<HistoricalSignalSearchResultDto> rows = new ArrayList<>();
        for (ReplaySessionSnapshotEntity snap : snapshots) {
            if (snap.getSessionDate() != null && to != null && snap.getSessionDate().isAfter(to)) {
                continue;
            }
            ReplayHistoryDto history = readReplayPayload(snap.getReplayPayloadJson());
            if (history == null || history.getTimeline() == null) continue;

            for (ReplaySignalEventDto event : history.getTimeline()) {
                if (event.getTimestamp() == null || event.getSignalType() == null) continue;
                long tsMs = parseEventMs(event.getTimestamp());
                if (tsMs < 0) continue;
                if (from != null && tsMs < from.atStartOfDay(ET).toInstant().toEpochMilli()) continue;
                if (to != null && tsMs > to.plusDays(1).atStartOfDay(ET).toInstant().toEpochMilli() - 1) continue;

                String sessionDate = snap.getSessionDate().toString();
                String signalId = symbol + "|" + sessionDate + "|" + tsMs + "|" + event.getSignalType();
                String decisionLabel = firstNonBlank(event.getSetupLabel(), event.getSignalType());
                String narrativeLabel = firstNonBlank(event.getSetupLabel(), event.getSignalType());
                Integer conviction = event.getScore();
                int replayIndex = resolveBarIndex(snap.getReplayPayloadJson(), tsMs);

                HistoricalSignalSearchResultDto dto = new HistoricalSignalSearchResultDto(
                        signalId,
                        symbol,
                        sessionDate,
                        ISO_TS.format(Instant.ofEpochMilli(tsMs)),
                        tsMs,
                        decisionLabel,
                        narrativeLabel,
                        conviction,
                        null,
                        null,
                        null,
                        conviction != null && conviction >= 80 ? "INSTITUTIONAL" : null,
                        snap.getReplayPayloadJson() != null,
                        replayIndex,
                        String.valueOf(snap.getId())
                );

                if (matchesDecision(dto, decision)
                        && matchesNarrative(dto, narrative)
                        && matchesQuality(dto, quality)
                        && matchesReplayResult(dto, result)) {
                    rows.add(dto);
                }
                if (rows.size() >= limit) {
                    return rows.stream()
                            .sorted((a, b) -> Long.compare(b.timestampMs(), a.timestampMs()))
                            .limit(limit)
                            .toList();
                }
            }
        }
        return rows.stream()
                .sorted((a, b) -> Long.compare(b.timestampMs(), a.timestampMs()))
                .limit(limit)
                .toList();
    }

    private ReplayHistoryDto readReplayPayload(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, ReplayHistoryDto.class);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private long parseEventMs(String timestamp) {
        try {
            return Instant.parse(timestamp).toEpochMilli();
        } catch (Exception ex) {
            try {
                return ZonedDateTime.parse(timestamp).toInstant().toEpochMilli();
            } catch (Exception ignored) {
                return -1;
            }
        }
    }

    private boolean matchesDecision(HistoricalSignalSearchResultDto dto, String decision) {
        if (decision == null || decision.isBlank()) return true;
        return decision.equalsIgnoreCase(dto.decision());
    }

    private boolean matchesNarrative(HistoricalSignalSearchResultDto dto, String narrative) {
        if (narrative == null || narrative.isBlank()) return true;
        String needle = narrative.toLowerCase();
        String path = dto.narrative() != null ? dto.narrative().toLowerCase() : "";
        String dec = dto.decision() != null ? dto.decision().toLowerCase() : "";
        return path.contains(needle) || dec.contains(needle);
    }

    private boolean matchesReplayResult(HistoricalSignalSearchResultDto dto, String result) {
        if (result == null || result.isBlank()) return true;
        // Replay-cache rows lack evaluated outcomes — skip strict result filters.
        return "ALL".equalsIgnoreCase(result);
    }

    private boolean matchesQuality(HistoricalSignalSearchResultDto dto, String quality) {
        if (quality == null || quality.isBlank()) return true;
        return switch (quality.toUpperCase()) {
            case "ELITE" -> dto.conviction() != null && dto.conviction() >= 80;
            case "HIGH" -> dto.conviction() != null && dto.conviction() >= 70;
            case "INSTITUTIONAL" -> "INSTITUTIONAL".equalsIgnoreCase(dto.entryQuality());
            case "LOW_FAKEOUT" -> dto.fakeoutRisk() == null || dto.fakeoutRisk() < 0.35;
            case "HIGH_EXPECTANCY" -> dto.expectancy() != null && dto.expectancy() >= 2.0;
            default -> true;
        };
    }

    private boolean matchesResult(HistoricalSignalSearchResultDto dto, EvaluatedSignalSnapshotEntity entity, String result) {
        if (result == null || result.isBlank()) return true;
        return switch (result.toUpperCase()) {
            case "WINNERS" -> "WIN".equalsIgnoreCase(entity.getWinLoss());
            case "LOSERS" -> "LOSS".equalsIgnoreCase(entity.getWinLoss());
            case "GT_2R" -> dto.actualR() != null && dto.actualR() >= 2.0;
            case "TRAP_AVOIDED" -> Boolean.TRUE.equals(entity.getFakeout());
            case "FAKEOUTS" -> "LOSS".equalsIgnoreCase(entity.getWinLoss())
                    && entity.getMae() != null && entity.getMae() <= -1.0;
            default -> result.equalsIgnoreCase(entity.getWinLoss());
        };
    }

    private JsonNode readPayload(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private Integer parseConviction(String stored, JsonNode payload) {
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
        return null;
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

    private long parseCandleMs(String time) {
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
}
