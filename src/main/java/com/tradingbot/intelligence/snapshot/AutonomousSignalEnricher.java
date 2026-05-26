package com.tradingbot.intelligence.snapshot;

import com.tradingbot.analytics.storage.entity.EvaluatedSignalSnapshotEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Locale;

/** Phase 165 — maps evaluated snapshots to autonomous display fields for Signal Explorer. */
@Component
@RequiredArgsConstructor
public class AutonomousSignalEnricher {

    private final IntelligenceSignalContextFactory contextFactory;
    private final IntelligenceScoringEngine scoringEngine;

    public record EnrichedSignal(
            String traderAction,
            String opportunityType,
            String eventLabel,
            int convictionScore,
            String entryQuality
    ) {}

    public EnrichedSignal enrich(EvaluatedSignalSnapshotEntity entity, int barIndex) {
        IntelligenceSignalContext ctx = contextFactory.toContext(entity, barIndex);
        IntelligenceScoringEngine.Scores s = scoringEngine.score(ctx);
        IntelligenceScoringEngine.TriggerResult t = scoringEngine.trigger(ctx, s);

        String opportunityType = mapOpportunityType(
                t.triggerType() != null ? t.triggerType() : "",
                t.traderAction() != null ? t.traderAction() : "",
                t.classification() != null ? t.classification() : ""
        );
        int conviction = computeConviction(opportunityType, s, t);
        String action = mapTraderActionDisplay(t.traderAction(), opportunityType);
        String label = eventLabel(opportunityType, action);
        String quality = mapEntryQuality(s.continuationIntegrity(), opportunityType, entity);

        return new EnrichedSignal(action, opportunityType, label, conviction, quality);
    }

    private String eventLabel(String opportunityType, String action) {
        return action + " · " + opportunityType.replace('_', ' ');
    }

    private String mapTraderActionDisplay(String traderAction, String opportunityType) {
        if ("LATE_STAGE_EXHAUSTION".equals(opportunityType)) return "AVOID";
        if (traderAction == null || traderAction.isBlank()) return "WATCH";
        String a = traderAction.toUpperCase(Locale.US);
        if (a.contains("ADD")) return "ADD";
        if (a.contains("EXHAUSTION") || a.contains("CHASE")) return "AVOID";
        if (a.contains("WAIT")) return "WATCH";
        return "ENTER";
    }

    private String mapEntryQuality(int integrity, String opportunityType, EvaluatedSignalSnapshotEntity entity) {
        if ("LATE_STAGE_EXHAUSTION".equals(opportunityType)) return "EXHAUSTED";
        if (entity.getEntryLocationQuality() != null && !entity.getEntryLocationQuality().isBlank()) {
            return entity.getEntryLocationQuality().toUpperCase(Locale.US);
        }
        if (integrity >= 75) return "INSTITUTIONAL";
        if (integrity >= 58) return "IDEAL";
        if (integrity >= 45) return "EXTENDED";
        return "IDEAL";
    }

    static String mapOpportunityType(String entryType, String action, String classification) {
        String e = entryType != null ? entryType.toUpperCase(Locale.US) : "";
        String a = action != null ? action.toUpperCase(Locale.US) : "";
        String c = classification != null ? classification.toUpperCase(Locale.US) : "";
        if (a.contains("EXHAUSTION") || e.contains("EXHAUSTION") || c.contains("EXHAUSTION")) {
            return "LATE_STAGE_EXHAUSTION";
        }
        if (e.contains("SHALLOW") || c.contains("PULLBACK")) return "SHALLOW_PULLBACK_CONTINUATION";
        if (e.contains("VWAP")) return "VWAP_PERSISTENCE";
        if (e.contains("COMPRESSION") || e.contains("MICRO")) return "COMPRESSION_RELEASE";
        if (e.contains("ORB") || e.contains("ACCELERATION") || c.contains("ACCELERATION")) {
            return "INSTITUTIONAL_ACCELERATION";
        }
        if (e.contains("RESUMPTION")) return "TREND_RESUMPTION";
        if (c.contains("PERSISTENT") || c.contains("INSTITUTIONAL")) return "INSTITUTIONAL_ACCELERATION";
        if (c.contains("EXPLOSIVE") || c.contains("EARLY")) return "EARLY_CONTINUATION";
        return "EARLY_CONTINUATION";
    }

    static int computeConviction(String type, IntelligenceScoringEngine.Scores s,
                                 IntelligenceScoringEngine.TriggerResult t) {
        int expansion = s.expansionProbability();
        int persistence = s.continuationPersistence();
        int integrity = s.continuationIntegrity();
        int institutional = s.institutionalPressure();
        int exhaustion = s.exhaustionDrift();
        int executionQuality = Math.max(0, Math.min(100,
                (int) Math.round(expansion * 0.35 + integrity * 0.35 + persistence * 0.3)));
        if ("LATE_STAGE_EXHAUSTION".equals(type)) {
            return Math.max(0, Math.min(100, (int) Math.round(100 - exhaustion * 0.6)));
        }
        int triggerBoost = t.active() ? Math.min(12, t.triggerScore() / 8) : 0;
        int exhaustionInverse = 100 - exhaustion;
        double raw = persistence * 0.22 + expansion * 0.20 + integrity * 0.16 + institutional * 0.12
                + executionQuality * 0.14 + exhaustionInverse * 0.16 + triggerBoost;
        return Math.max(0, Math.min(100, (int) Math.round(raw)));
    }
}
