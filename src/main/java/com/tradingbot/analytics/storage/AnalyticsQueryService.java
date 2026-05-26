package com.tradingbot.analytics.storage;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.analytics.storage.dto.AnalyticsStorageDtos.*;
import com.tradingbot.analytics.storage.entity.EvaluatedSignalSnapshotEntity;
import com.tradingbot.analytics.storage.entity.HydrationSessionEntity;
import com.tradingbot.analytics.storage.entity.PlaybookCandidateEntity;
import com.tradingbot.analytics.storage.repository.DecisionFeedbackSnapshotRepository;
import com.tradingbot.analytics.storage.repository.EvaluatedSignalSnapshotRepository;
import com.tradingbot.analytics.storage.repository.HydrationSessionRepository;
import com.tradingbot.analytics.storage.repository.PlaybookCandidateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/** Query persisted analytics for frontend sync. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnalyticsQueryService {

    private final EvaluatedSignalSnapshotRepository snapshotRepository;
    private final HydrationSessionRepository hydrationRepository;
    private final PlaybookCandidateRepository playbookRepository;
    private final DecisionFeedbackSnapshotRepository feedbackRepository;
    private final AnalyticsVersionService versionService;
    private final ObjectMapper objectMapper;

    public AnalyticsVersionDto versionInfo() {
        int version = versionService.currentVersion();
        long snapCount = snapshotRepository.countByAnalyticsVersion(version);
        long pbCount = playbookRepository.countByAnalyticsVersion(version);
        boolean stale = snapshotRepository.count() > 0 && snapCount < snapshotRepository.count();
        return new AnalyticsVersionDto(version, snapCount, pbCount, stale);
    }

    public StorageStatsDto stats() {
        int version = versionService.currentVersion();
        return new StorageStatsDto(
                snapshotRepository.countByAnalyticsVersion(version),
                hydrationRepository.count(),
                playbookRepository.countByAnalyticsVersion(version),
                feedbackRepository.count(),
                version
        );
    }

    public EvaluatedSnapshotPageDto fetchSnapshots(
            String symbol,
            Long fromTs,
            Long toTs,
            String setup,
            String regime,
            int page,
            int size
    ) {
        int version = versionService.currentVersion();
        Page<EvaluatedSignalSnapshotEntity> result = snapshotRepository.querySnapshots(
                symbol != null ? symbol.toUpperCase() : null,
                fromTs,
                toTs,
                setup,
                regime,
                version,
                PageRequest.of(page, Math.min(size, 1000))
        );
        List<JsonNode> signals = new ArrayList<>();
        for (EvaluatedSignalSnapshotEntity entity : result.getContent()) {
            try {
                signals.add(objectMapper.readTree(entity.getPayload()));
            } catch (JsonProcessingException ignored) {
                // skip corrupt row
            }
        }
        boolean authoritative = result.getTotalElements() >= 10;
        return new EvaluatedSnapshotPageDto(
                signals,
                page,
                size,
                result.getTotalElements(),
                version,
                authoritative
        );
    }

    public List<HydrationSessionDto> fetchAllHydration() {
        return hydrationRepository.findAllByOrderBySymbolAsc().stream()
                .map(this::toHydrationDto)
                .toList();
    }

    public HydrationSessionDto fetchHydration(String symbol) {
        return hydrationRepository.findBySymbol(symbol.toUpperCase())
                .map(this::toHydrationDto)
                .orElse(new HydrationSessionDto(
                        symbol.toUpperCase(), 60, 0, 0, "NOT_STARTED",
                        List.of(), versionService.currentVersion(), null, null, false
                ));
    }

    public List<JsonNode> fetchPlaybookCandidates() {
        int version = versionService.currentVersion();
        List<JsonNode> out = new ArrayList<>();
        for (PlaybookCandidateEntity entity : playbookRepository.findByAnalyticsVersionOrderByQualityScoreDesc(version)) {
            if (entity.getPayload() == null) continue;
            try {
                out.add(objectMapper.readTree(entity.getPayload()));
            } catch (JsonProcessingException ignored) {
                // skip
            }
        }
        return out;
    }

    private HydrationSessionDto toHydrationDto(HydrationSessionEntity e) {
        List<String> dates = readStringList(e.getEvaluatedSessionDates());
        return new HydrationSessionDto(
                e.getSymbol(),
                e.getLookbackDays(),
                e.getCandlesLoaded(),
                e.getSignalsEvaluated(),
                e.getStatus() != null ? e.getStatus().name() : "PARTIAL",
                dates,
                e.getAnalyticsVersion(),
                e.getStartedAt() != null ? e.getStartedAt().toString() : null,
                e.getCompletedAt() != null ? e.getCompletedAt().toString() : null,
                versionService.requiresRehydration(e.getAnalyticsVersion())
        );
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
        } catch (JsonProcessingException ex) {
            return List.of();
        }
    }
}
