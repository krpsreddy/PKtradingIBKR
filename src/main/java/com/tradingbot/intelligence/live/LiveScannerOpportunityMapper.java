package com.tradingbot.intelligence.live;

import com.tradingbot.intelligence.snapshot.IntelligenceScoringEngine;
import com.tradingbot.intelligence.snapshot.dto.IntelligenceSnapshotDtos.ScannerOpportunityDto;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Maps live regime evaluation → scanner DTO (same taxonomy as Phase 165). */
public final class LiveScannerOpportunityMapper {

    private LiveScannerOpportunityMapper() {}

    public static ScannerOpportunityDto toOpportunity(
            String sym,
            RealtimeRegimeEngine.LiveRegimeEvaluation eval,
            String windowLabel,
            String rvolLabel
    ) {
        IntelligenceScoringEngine.TriggerResult t = eval.trigger();
        IntelligenceScoringEngine.Scores s = eval.scores();
        String entryType = t.active() ? t.triggerType() : eval.fallbackType();
        String action = t.active() ? t.traderAction() : "WATCH";
        String classification = t.active() ? t.classification() : eval.fallbackClassification();
        String opportunityType = mapOpportunityType(entryType, action, classification);
        String traderAction = mapTraderAction(opportunityType, action);
        String tone = mapTone(opportunityType);
        String badge = mapBadge(opportunityType);

        int expansion = s.expansionProbability();
        int persistence = s.continuationPersistence();
        int triggerIntegrity = t.active() ? t.triggerScore() : integrityFromScores(s);
        int institutional = s.institutionalPressure();
        int exhaustion = s.exhaustionDrift();
        int executionQuality = Math.max(0, Math.min(100,
                (int) Math.round(expansion * 0.35 + triggerIntegrity * 0.35 + persistence * 0.3)));
        int conviction = computeConviction(opportunityType, expansion, persistence, triggerIntegrity,
                institutional, exhaustion, executionQuality);
        conviction = Math.max(conviction, eval.liveBoost());

        List<String> whyNow = new ArrayList<>(eval.liveWhyNow());
        if (t.active() && t.triggerReason() != null && !t.triggerReason().isBlank() && whyNow.size() < 3) {
            whyNow.add(t.triggerReason());
        }
        if (exhaustion >= 55) whyNow.add("exhaustion drift detected");
        if (whyNow.isEmpty()) whyNow.add("live regime scan · session " + windowLabel);

        String entryZone = eval.entryZoneLabel() != null ? eval.entryZoneLabel() : "—";
        String risk = "LATE_STAGE_EXHAUSTION".equals(opportunityType) ? "HIGH" : "LOW";

        return ScannerOpportunityDto.base(
                sym, opportunityType, traderAction, tone, badge, conviction,
                expansion, persistence, triggerIntegrity, institutional, exhaustion, executionQuality,
                entryZone, risk, whyNow.stream().limit(4).toList(), windowLabel, rvolLabel
        );
    }

    private static int integrityFromScores(IntelligenceScoringEngine.Scores s) {
        return Math.max(40, Math.min(88, s.continuationIntegrity()));
    }

    private static int computeConviction(String type, int expansion, int persistence, int integrity,
                                         int institutional, int exhaustion, int executionQuality) {
        if ("LATE_STAGE_EXHAUSTION".equals(type)) {
            return Math.max(0, Math.min(100, (int) Math.round(100 - exhaustion * 0.6)));
        }
        int exhaustionInverse = 100 - exhaustion;
        double raw = persistence * 0.22 + expansion * 0.20 + integrity * 0.16 + institutional * 0.12
                + executionQuality * 0.14 + exhaustionInverse * 0.16;
        return Math.max(0, Math.min(100, (int) Math.round(raw)));
    }

    private static String mapOpportunityType(String entryType, String action, String classification) {
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
        return "EARLY_CONTINUATION";
    }

    private static String mapTraderAction(String type, String action) {
        if ("LATE_STAGE_EXHAUSTION".equals(type)) return "AVOID";
        String a = action != null ? action.toUpperCase(Locale.US) : "";
        if (a.contains("ADD")) return "ADD";
        if (a.contains("EXHAUSTION") || a.contains("CHASE")) return "AVOID";
        if (a.contains("WAIT") || a.contains("WATCH")) return "WATCH";
        return "ENTER";
    }

    private static String mapTone(String type) {
        return switch (type) {
            case "LATE_STAGE_EXHAUSTION" -> "RED";
            case "TREND_RESUMPTION" -> "ORANGE";
            case "SHALLOW_PULLBACK_CONTINUATION" -> "YELLOW";
            default -> "GREEN";
        };
    }

    private static String mapBadge(String type) {
        return switch (type) {
            case "EARLY_CONTINUATION" -> "🟢 HIGH CONTINUATION";
            case "SHALLOW_PULLBACK_CONTINUATION" -> "🟡 HEALTHY PULLBACK";
            case "VWAP_PERSISTENCE" -> "🟢 VWAP PERSISTENCE";
            case "INSTITUTIONAL_ACCELERATION" -> "🟢 INSTITUTIONAL PERSISTENCE";
            case "COMPRESSION_RELEASE" -> "🟢 COMPRESSION BREAKOUT";
            case "TREND_RESUMPTION" -> "🟠 LATE EXTENSION";
            case "LATE_STAGE_EXHAUSTION" -> "🔴 EXHAUSTION DEVELOPING";
            default -> "🟢 EARLY EXPANSION";
        };
    }
}
