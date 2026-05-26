package com.tradingbot.analytics.storage;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.analytics.storage.dto.AnalyticsStorageDtos.BulkUpsertResultDto;
import com.tradingbot.analytics.storage.dto.AnalyticsStorageDtos.DecisionFeedbackPersistDto;
import com.tradingbot.analytics.storage.dto.AnalyticsStorageDtos.HydrationSessionDto;
import com.tradingbot.analytics.storage.dto.AnalyticsStorageDtos.PlaybookCandidatePersistDto;
import com.tradingbot.analytics.storage.entity.DecisionFeedbackSnapshotEntity;
import com.tradingbot.analytics.storage.entity.EvaluatedSignalSnapshotEntity;
import com.tradingbot.analytics.storage.entity.HydrationSessionEntity;
import com.tradingbot.analytics.storage.entity.HydrationSessionEntity.HydrationStatus;
import com.tradingbot.analytics.storage.entity.PlaybookCandidateEntity;
import com.tradingbot.analytics.storage.repository.DecisionFeedbackSnapshotRepository;
import com.tradingbot.analytics.storage.repository.EvaluatedSignalSnapshotRepository;
import com.tradingbot.analytics.storage.repository.HydrationSessionRepository;
import com.tradingbot.analytics.storage.repository.PlaybookCandidateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/** Persist canonical evaluated analytics — replay-safe upserts. */
@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsPersistenceService {

    private static final ZoneId ET = ZoneId.of("America/New_York");

    private final EvaluatedSignalSnapshotRepository snapshotRepository;
    private final HydrationSessionRepository hydrationRepository;
    private final PlaybookCandidateRepository playbookRepository;
    private final DecisionFeedbackSnapshotRepository feedbackRepository;
    private final AnalyticsVersionService versionService;
    private final ObjectMapper objectMapper;

    @Transactional
    public BulkUpsertResultDto bulkUpsertSnapshots(List<JsonNode> signals, Integer clientVersion) {
        int version = versionService.currentVersion();
        if (clientVersion != null && !versionService.isCompatible(clientVersion)) {
            log.warn("Client analytics version {} incompatible with server {}", clientVersion, version);
        }
        int upserted = 0;
        int skipped = 0;
        for (JsonNode node : signals) {
            if (node == null || !node.hasNonNull("id")) {
                skipped++;
                continue;
            }
            try {
                upsertSnapshot(node, version);
                upserted++;
            } catch (Exception ex) {
                log.debug("Skip snapshot upsert: {}", ex.getMessage());
                skipped++;
            }
        }
        return new BulkUpsertResultDto(upserted, skipped, version);
    }

    @Transactional
    public HydrationSessionDto upsertHydration(HydrationSessionDto dto) {
        int version = versionService.currentVersion();
        String symbol = dto.symbol().toUpperCase();
        HydrationSessionEntity entity = hydrationRepository.findBySymbol(symbol)
                .orElseGet(() -> HydrationSessionEntity.builder().symbol(symbol).build());

        entity.setLookbackDays(dto.lookbackDays());
        entity.setCandlesLoaded(dto.candlesLoaded());
        entity.setSignalsEvaluated(dto.signalsEvaluated());
        entity.setStatus(parseStatus(dto.status()));
        entity.setEvaluatedSessionDates(writeJson(dto.evaluatedSessionDates()));
        entity.setAnalyticsVersion(version);
        if (dto.startedAt() != null) {
            entity.setStartedAt(Instant.parse(dto.startedAt()));
        }
        if (dto.completedAt() != null) {
            entity.setCompletedAt(Instant.parse(dto.completedAt()));
        }
        hydrationRepository.save(entity);
        return toHydrationDto(entity);
    }

    @Transactional
    public int bulkUpsertPlaybookCandidates(List<PlaybookCandidatePersistDto> candidates) {
        int version = versionService.currentVersion();
        int count = 0;
        for (PlaybookCandidatePersistDto dto : candidates) {
            if (dto.payload() == null || dto.candidateId() == null) continue;
            PlaybookCandidateEntity entity = playbookRepository.findByCandidateId(dto.candidateId())
                    .orElseGet(() -> PlaybookCandidateEntity.builder().candidateId(dto.candidateId()).build());
            JsonNode p = dto.payload();
            entity.setCandidateKey(textOr(dto.candidateKey(), p.path("id").asText("")));
            entity.setNarrativePath(textOr(null, joinTags(p)));
            entity.setSequence(writeJson(p.path("sequence")));
            entity.setExpectancy(numOrNull(p.path("expectancyR")));
            entity.setContinuation(numOrNull(p.path("continuationStrength")));
            entity.setFakeout(numOrNull(p.path("fakeoutRate")));
            entity.setQualityScore(p.path("qualityScore").isNumber() ? p.path("qualityScore").asInt() : null);
            entity.setConfidenceBand(textOr(null, p.path("confidence").asText(null)));
            entity.setEvolutionState(textOr(null, p.path("evolutionState").asText(null)));
            entity.setPromotionState(parsePromotion(textOr(null, p.path("promotionState").asText("DISCOVERED"))));
            entity.setPayload(writeJson(p));
            entity.setAnalyticsVersion(version);
            playbookRepository.save(entity);
            count++;
        }
        return count;
    }

    @Transactional
    public int bulkUpsertDecisionFeedback(List<DecisionFeedbackPersistDto> rows) {
        int version = versionService.currentVersion();
        int count = 0;
        for (DecisionFeedbackPersistDto dto : rows) {
            if (dto.signalId() == null || dto.payload() == null) continue;
            DecisionFeedbackSnapshotEntity entity = feedbackRepository.findBySignalId(dto.signalId())
                    .orElseGet(() -> DecisionFeedbackSnapshotEntity.builder().signalId(dto.signalId()).build());
            JsonNode p = dto.payload();
            entity.setDecision(textOr(null, p.path("decision").asText(null)));
            entity.setConvictionBand(textOr(null, p.path("conviction").asText(null)));
            entity.setActualOutcome(textOr(null, p.path("outcome").asText(null)));
            entity.setCorrectness(p.path("correct").isBoolean() ? p.path("correct").asBoolean() : null);
            entity.setPayload(writeJson(p));
            entity.setAnalyticsVersion(version);
            feedbackRepository.save(entity);
            count++;
        }
        return count;
    }

    private void upsertSnapshot(JsonNode node, int version) throws JsonProcessingException {
        String signalId = node.path("id").asText();
        EvaluatedSignalSnapshotEntity entity = snapshotRepository.findBySignalId(signalId)
                .orElseGet(() -> EvaluatedSignalSnapshotEntity.builder().signalId(signalId).build());

        long ts = node.path("timestamp").asLong(System.currentTimeMillis());
        JsonNode eval = node.path("evaluation");

        entity.setSymbol(textOr("UNK", node.path("symbol").asText("UNK")).toUpperCase());
        entity.setTimestampMs(ts);
        entity.setSessionDate(LocalDate.ofInstant(Instant.ofEpochMilli(ts), ET));
        entity.setSetup(textOr(null, node.path("signalType").asText(null)));
        entity.setRegime(textOr(null, node.path("marketRegime").asText(null)));
        entity.setMarketCondition(textOr(null, node.path("captureStage").asText(null)));
        entity.setNarrativePath(null);
        entity.setDecision(null);
        entity.setConviction(node.path("convictionScore").isNumber() ? String.valueOf(node.path("convictionScore").asInt()) : null);
        entity.setMfe(eval.path("mfeR").isNumber() ? eval.path("mfeR").asDouble() : null);
        entity.setMae(eval.path("maeR").isNumber() ? eval.path("maeR").asDouble() : null);
        entity.setContinuationPercent(eval.path("hit1R").asBoolean(false) ? 100.0 : 0.0);
        entity.setFakeout(null);
        entity.setWinLoss(textOr(null, eval.path("status").asText(null)));
        entity.setPayload(objectMapper.writeValueAsString(node));
        entity.setAnalyticsVersion(version);
        snapshotRepository.save(entity);
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

    private HydrationStatus parseStatus(String status) {
        if (status == null) return HydrationStatus.PARTIAL;
        try {
            return HydrationStatus.valueOf(status);
        } catch (IllegalArgumentException ex) {
            return HydrationStatus.PARTIAL;
        }
    }

    private PlaybookCandidateEntity.PromotionState parsePromotion(String state) {
        if (state == null) return PlaybookCandidateEntity.PromotionState.DISCOVERED;
        try {
            return PlaybookCandidateEntity.PromotionState.valueOf(state);
        } catch (IllegalArgumentException ex) {
            return PlaybookCandidateEntity.PromotionState.DISCOVERED;
        }
    }

    private String writeJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
        } catch (JsonProcessingException ex) {
            return List.of();
        }
    }

    private String textOr(String fallback, String value) {
        return value != null && !value.isBlank() ? value : fallback;
    }

    private Double numOrNull(JsonNode node) {
        return node != null && node.isNumber() ? node.asDouble() : null;
    }

    private String joinTags(JsonNode p) {
        List<String> tags = new ArrayList<>();
        if (p.has("sequence") && p.get("sequence").isArray()) {
            for (JsonNode step : p.get("sequence")) {
                if (step.has("contextTags") && step.get("contextTags").isArray()) {
                    step.get("contextTags").forEach(t -> tags.add(t.asText()));
                }
            }
        }
        return tags.isEmpty() ? null : String.join(",", tags);
    }
}
