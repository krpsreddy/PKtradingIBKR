package com.tradingbot.replay.cache;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.analytics.storage.AnalyticsVersionService;
import com.tradingbot.api.dto.ReplayHistoryDto;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.replay.cache.dto.ReplayCacheDtos.ReplaySnapshotSummaryDto;
import com.tradingbot.replay.cache.dto.ReplayCacheDtos.SymbolSnapshotPageDto;
import com.tradingbot.replay.cache.entity.ReplaySessionMetadataEntity;
import com.tradingbot.replay.cache.entity.ReplaySessionSnapshotEntity;
import com.tradingbot.replay.cache.entity.ReplaySessionSnapshotEntity.ReplayStatus;
import com.tradingbot.replay.cache.repository.ReplaySessionMetadataRepository;
import com.tradingbot.replay.cache.repository.ReplaySessionSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

/** Persist and load replay session snapshots — replay-safe upserts. */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReplaySnapshotService {

    private final ReplaySessionSnapshotRepository snapshotRepository;
    private final ReplaySessionMetadataRepository metadataRepository;
    private final AnalyticsVersionService versionService;
    private final ObjectMapper objectMapper;

    public Optional<ReplayHistoryDto> loadSession(String symbol, LocalDate sessionDate) {
        return snapshotRepository.findBySymbolAndSessionDate(symbol.toUpperCase(), sessionDate)
                .filter(s -> s.getReplayStatus() == ReplayStatus.READY)
                .map(this::toDto);
    }

    public List<ReplayHistoryDto> loadReadySessions(String symbol, LocalDate cutoff) {
        return snapshotRepository
                .findBySymbolAndSessionDateGreaterThanEqualOrderBySessionDateAsc(symbol.toUpperCase(), cutoff)
                .stream()
                .filter(s -> s.getReplayStatus() == ReplayStatus.READY
                        && versionService.isCompatible(s.getAnalyticsVersion()))
                .map(this::toDto)
                .filter(Objects::nonNull)
                .toList();
    }

    public Map<LocalDate, ReplaySessionSnapshotEntity> loadSnapshotMap(String symbol, LocalDate cutoff) {
        return snapshotRepository
                .findBySymbolAndSessionDateGreaterThanEqualOrderBySessionDateAsc(symbol.toUpperCase(), cutoff)
                .stream()
                .collect(Collectors.toMap(ReplaySessionSnapshotEntity::getSessionDate, s -> s, (a, b) -> a));
    }

    public SymbolSnapshotPageDto summarize(String symbol, List<LocalDate> windowDates,
                                           Map<LocalDate, ReplaySessionSnapshotEntity> snapshots,
                                           Map<LocalDate, String> candleHashes) {
        String sym = symbol.toUpperCase();
        int version = versionService.currentVersion();
        int ready = 0;
        int stale = 0;
        int missing = 0;
        List<ReplaySnapshotSummaryDto> rows = new ArrayList<>();

        for (LocalDate date : windowDates) {
            ReplaySessionSnapshotEntity snap = snapshots.get(date);
            String hash = candleHashes.getOrDefault(date, "");
            if (snap == null) {
                missing++;
                rows.add(new ReplaySnapshotSummaryDto(sym, date.toString(), version, hash, "MISSING", 0, 0, true));
                continue;
            }
            boolean fresh = snap.getReplayStatus() == ReplayStatus.READY
                    && versionService.isCompatible(snap.getAnalyticsVersion())
                    && snap.getCandlesHash().equals(hash);
            if (fresh) {
                ready++;
            } else {
                stale++;
            }
            rows.add(new ReplaySnapshotSummaryDto(
                    sym, date.toString(), snap.getAnalyticsVersion(), snap.getCandlesHash(),
                    fresh ? "READY" : "STALE",
                    extractBarCount(snap), extractSignalCount(snap), !fresh));
        }

        return new SymbolSnapshotPageDto(sym, version, windowDates.size(), ready, stale, missing, rows);
    }

    @Transactional
    public void persistSession(ReplayHistoryDto session, String candlesHash,
                               IndicatorResult lastIndicators, long replayDurationMs) {
        if (session == null || session.getReplayDate() == null) return;

        String sym = session.getSymbol().toUpperCase();
        LocalDate date = LocalDate.parse(session.getReplayDate());
        int version = versionService.currentVersion();

        ReplaySessionSnapshotEntity entity = snapshotRepository.findBySymbolAndSessionDate(sym, date)
                .orElseGet(() -> ReplaySessionSnapshotEntity.builder().symbol(sym).sessionDate(date).build());

        entity.setAnalyticsVersion(version);
        entity.setCandlesHash(candlesHash);
        entity.setSessionHash(ReplayHashUtil.hashString(writeJson(session)));
        entity.setReplayStatus(ReplayStatus.READY);
        entity.setReplayPayloadJson(writeJson(session));
        entity.setTimelineJson(writeJson(session.getTimeline()));
        entity.setIndicatorSnapshotJson(lastIndicators != null ? writeJson(lastIndicators) : null);
        snapshotRepository.save(entity);

        ReplaySessionMetadataEntity meta = metadataRepository.findBySymbolAndSessionDate(sym, date)
                .orElseGet(() -> ReplaySessionMetadataEntity.builder().symbol(sym).sessionDate(date).build());
        meta.setCandlesHash(candlesHash);
        meta.setAnalyticsVersion(version);
        meta.setLastReplayAt(Instant.now());
        meta.setReplayDurationMs(replayDurationMs);
        meta.setSignalsCount(session.getSimulatedSignals());
        meta.setTransitionsCount(session.getTimeline() != null ? session.getTimeline().size() : 0);
        meta.setNarrativesCount(session.getLifecyclePath() != null ? session.getLifecyclePath().size() : 0);
        metadataRepository.save(meta);
    }

    @Transactional
    public void markStale(String symbol, LocalDate sessionDate) {
        snapshotRepository.findBySymbolAndSessionDate(symbol.toUpperCase(), sessionDate)
                .ifPresent(s -> {
                    s.setReplayStatus(ReplayStatus.STALE);
                    snapshotRepository.save(s);
                });
    }

    private ReplayHistoryDto toDto(ReplaySessionSnapshotEntity entity) {
        try {
            return objectMapper.readValue(entity.getReplayPayloadJson(), ReplayHistoryDto.class);
        } catch (JsonProcessingException e) {
            log.warn("Failed to deserialize replay snapshot {} {}", entity.getSymbol(), entity.getSessionDate());
            return null;
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private int extractBarCount(ReplaySessionSnapshotEntity snap) {
        ReplayHistoryDto dto = toDto(snap);
        return dto != null ? dto.getTotalBars() : 0;
    }

    private int extractSignalCount(ReplaySessionSnapshotEntity snap) {
        ReplayHistoryDto dto = toDto(snap);
        if (dto == null) return 0;
        if (dto.getSimulatedSignals() > 0) return dto.getSimulatedSignals();
        if (dto.getTimeline() != null && !dto.getTimeline().isEmpty()) return dto.getTimeline().size();
        return 0;
    }

    public List<com.tradingbot.replay.cache.dto.ReplayCacheDtos.SessionSummaryDto> sessionSummaries(
            String symbol, LocalDate cutoff) {
        String sym = symbol.toUpperCase();
        return snapshotRepository
                .findBySymbolAndSessionDateGreaterThanEqualOrderBySessionDateAsc(sym, cutoff)
                .stream()
                .map(this::toSessionSummary)
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private com.tradingbot.replay.cache.dto.ReplayCacheDtos.SessionSummaryDto toSessionSummary(
            ReplaySessionSnapshotEntity snap) {
        ReplayHistoryDto dto = toDto(snap);
        if (dto == null) return null;

        int signalCount = extractSignalCount(snap);
        boolean compatible = versionService.isCompatible(snap.getAnalyticsVersion());
        boolean ready = snap.getReplayStatus() == ReplayStatus.READY && compatible;
        boolean stale = !ready;

        String status;
        if (ready && signalCount > 0) {
            status = "READY";
        } else if (ready) {
            status = "NO_SIGNALS";
        } else if (snap.getReplayStatus() == ReplayStatus.PROCESSING) {
            status = "REPLAYING";
        } else if (signalCount > 0 && snap.getReplayPayloadJson() != null) {
            status = "CACHE_ONLY";
        } else if (signalCount > 0) {
            status = "PARTIAL";
        } else {
            status = "STALE";
        }

        double convictionAvg = avgScore(dto);
        String bestDecision = bestEntryLabel(dto);
        String bestNarrative = dto.getLifecyclePath() != null && !dto.getLifecyclePath().isEmpty()
                ? dto.getLifecyclePath().get(dto.getLifecyclePath().size() - 1) : null;

        return new com.tradingbot.replay.cache.dto.ReplayCacheDtos.SessionSummaryDto(
                snap.getSessionDate().toString(),
                signalCount,
                convictionAvg > 0 ? convictionAvg : null,
                ready,
                stale,
                bestDecision,
                bestNarrative,
                null,
                status
        );
    }

    private double avgScore(ReplayHistoryDto dto) {
        if (dto.getTimeline() == null || dto.getTimeline().isEmpty()) return 0;
        return dto.getTimeline().stream()
                .filter(e -> e.getScore() != null)
                .mapToInt(e -> e.getScore())
                .average()
                .orElse(0);
    }

    private String bestEntryLabel(ReplayHistoryDto dto) {
        if (dto.getTimeline() == null) return null;
        return dto.getTimeline().stream()
                .filter(e -> e.getSignalType() != null && e.getSignalType().endsWith("_BUY"))
                .max(java.util.Comparator.comparingInt(e -> e.getScore() != null ? e.getScore() : 0))
                .map(e -> e.getSignalType())
                .orElse(null);
    }
}
