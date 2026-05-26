package com.tradingbot.intelligence.snapshot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.analytics.storage.entity.EvaluatedSignalSnapshotEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/** Builds normalized intelligence context from evaluated snapshot entities. */
@Component
@RequiredArgsConstructor
public class IntelligenceSignalContextFactory {

    private static final ZoneId ET = ZoneId.of("America/New_York");

    private final ObjectMapper objectMapper;

    public IntelligenceSignalContext toContext(EvaluatedSignalSnapshotEntity e, int barIndex) {
        JsonNode p = readPayload(e.getPayload());
        Double rvol = dbl(p, "relativeVolume");
        if (rvol == null) rvol = dbl(p, "rvol");
        Double vwapDist = dbl(p, "vwapDistance");
        Double trend = dbl(p, "trendAlignment");
        if (trend == null) trend = dbl(p, "convictionScore");
        Double vol = dbl(p, "volatility");
        Double price = dbl(p, "entryPrice");
        if (price == null) price = dbl(p, "price");
        Integer sessionMins = p != null && p.path("sessionTimeMinutes").isNumber()
                ? p.path("sessionTimeMinutes").asInt() : null;
        Boolean extended = p != null && p.has("extendedEntry") ? p.path("extendedEntry").asBoolean() : null;
        if (extended == null && p != null && p.has("extended")) {
            extended = p.path("extended").asBoolean();
        }
        double mfeR = e.getMfe() != null ? e.getMfe() : 0;
        if (p != null && p.path("evaluation").path("mfeR").isNumber()) {
            mfeR = p.path("evaluation").path("mfeR").asDouble();
        }
        String sessionDate = e.getSessionDate() != null
                ? e.getSessionDate().toString()
                : LocalDate.ofInstant(Instant.ofEpochMilli(e.getTimestampMs()), ET).toString();
        String signalType = firstNonBlank(e.getSetup(), e.getDecision());
        return new IntelligenceSignalContext(
                e.getSignalId(), e.getSymbol(), sessionDate, e.getTimestampMs(), barIndex,
                e.getRegime(), signalType, rvol, vwapDist, trend,
                trend, extended, vol, price, sessionMins, mfeR
        );
    }

    private JsonNode readPayload(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            return null;
        }
    }

    private Double dbl(JsonNode p, String field) {
        return p != null && p.path(field).isNumber() ? p.path(field).asDouble() : null;
    }

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }
}
