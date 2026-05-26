package com.tradingbot.intelligence.snapshot;

import org.springframework.stereotype.Component;

/** Phase 164 — server-side regime + trigger scoring (mirrors frontend Phase 162/163). */
@Component
public class IntelligenceScoringEngine {

    public record Scores(
            int continuationIntegrity,
            int pullbackEfficiency,
            int compressionEnergy,
            int extensionHealth,
            int continuationVelocity,
            int institutionalPressure,
            int exhaustionDrift,
            int expansionProbability,
            int continuationPersistence
    ) {}

    public record TriggerResult(
            String regimeType,
            String classification,
            String triggerType,
            String traderAction,
            int triggerScore,
            String chartZone,
            boolean addOpportunity,
            String triggerReason,
            String whyValid,
            boolean active
    ) {}

    public Scores score(IntelligenceSignalContext ctx) {
        int persistence = continuationPersistence(ctx);
        int velocity = continuationVelocity(ctx);
        int pullback = pullbackEfficiency(ctx);
        int compression = compressionEnergy(ctx);
        int extension = extensionHealth(ctx);
        int exhaustion = exhaustionDrift(ctx);
        int institutional = clamp((int) (velocity * 0.7 + (ctx.rvol() != null ? ctx.rvol() * 3 : 0)
                + (regimeBoost(ctx.marketRegime()))));
        int expansion = clamp((int) (persistence * 0.3 + velocity * 0.25 + pullback * 0.2 + institutional * 0.25));
        if (inContinuationWindow(ctx.sessionTimeMinutes())) expansion = clamp(expansion + 8);
        if (isChop(ctx.marketRegime())) expansion = clamp(expansion - 15);
        return new Scores(persistence, pullback, compression, extension, velocity, institutional,
                exhaustion, expansion, persistence);
    }

    public TriggerResult trigger(IntelligenceSignalContext ctx, Scores s) {
        if (exhaustionDrift(ctx) >= 75 && persistence(ctx) < 50) {
            return inactive("DO_NOT_CHASE", "EXHAUSTION_DEVELOPING", s.exhaustionDrift(),
                    "Do not chase — extension without RVOL sustain", false);
        }
        if (s.exhaustionDrift() >= 68 && s.continuationIntegrity() >= 55) {
            return inactive("LATE_STAGE_EXHAUSTION", "EXHAUSTION_DEVELOPING", s.exhaustionDrift(),
                    "Late-stage exhaustion developing", true);
        }

        var ranked = rankTriggers(ctx, s);
        if (ranked.score() < 55) {
            return inactive("", "", 0, "No tactical trigger", false);
        }

        String regime = detectRegime(ctx, s);
        String classification = classify(regime, s, ctx);
        String action = traderAction(ranked.type(), ranked.add());
        return new TriggerResult(
                regime,
                classification,
                ranked.type(),
                action,
                ranked.score(),
                chartZone(ranked.type(), s),
                ranked.add(),
                triggerReason(ranked.type(), s, ctx),
                whyValid(ranked.type(), s, ctx),
                true
        );
    }

    public String classifyRegime(IntelligenceSignalContext ctx, Scores s) {
        return classify(detectRegime(ctx, s), s, ctx);
    }

    public String detectRegimeType(IntelligenceSignalContext ctx, Scores s) {
        return detectRegime(ctx, s);
    }

    private record Ranked(String type, int score, boolean add) {}

    private Ranked rankTriggers(IntelligenceSignalContext ctx, Scores s) {
        Ranked[] all = {
                new Ranked("DIRECT_CONTINUATION_ENTRY", directScore(ctx, s), false),
                new Ranked("SHALLOW_PULLBACK_ENTRY", s.pullbackEfficiency(), false),
                new Ranked("VWAP_PERSISTENCE_ENTRY", vwapScore(ctx), false),
                new Ranked("MICRO_COMPRESSION_BREAKOUT", s.compressionEnergy(), true),
                new Ranked("ORB_CONTINUATION_ADD", orbScore(ctx), true),
                new Ranked("ACCELERATION_RECLAIM", reclaimScore(ctx, s), false),
                new Ranked("TREND_RESUMPTION_ENTRY", resumptionScore(ctx, s), false)
        };
        Ranked best = all[0];
        for (Ranked r : all) {
            if (r.score() > best.score()) best = r;
        }
        return best;
    }

    private int directScore(IntelligenceSignalContext ctx, Scores s) {
        int score = (int) (s.continuationIntegrity() * 0.35 + s.continuationVelocity() * 0.35 + s.extensionHealth() * 0.2);
        if (ctx.rvol() != null && ctx.rvol() >= 2.5) score += 10;
        if (ctx.vwapDistance() != null && ctx.vwapDistance() >= 0) score += 8;
        return clamp(score);
    }

    private int continuationPersistence(IntelligenceSignalContext ctx) {
        double vwap = ctx.vwapDistance() != null ? ctx.vwapDistance() : 0;
        double rvol = ctx.rvol() != null ? ctx.rvol() : 0;
        double structure = ctx.trendAlignment() != null ? ctx.trendAlignment() : 0;
        int score = 25;
        if (vwap >= 0) score += 18;
        if (vwap >= 0.005 && vwap < 0.025) score += 12;
        if (rvol >= 2) score += 20;
        else if (rvol >= 1.5) score += 12;
        if (structure >= 60) score += 18;
        else if (structure >= 48) score += 10;
        if (Boolean.TRUE.equals(ctx.extended()) && rvol >= 2 && structure >= 55) score += 10;
        if (Math.abs(vwap) > 0.04) score -= 12;
        return clamp(score);
    }

    private int continuationVelocity(IntelligenceSignalContext ctx) {
        double rvol = ctx.rvol() != null ? ctx.rvol() : 0;
        double structure = ctx.trendAlignment() != null ? ctx.trendAlignment() : 0;
        int score = 28;
        if (rvol >= 3.5) score += 28;
        else if (rvol >= 2.5) score += 22;
        else if (rvol >= 2) score += 15;
        if (structure >= 68) score += 22;
        else if (structure >= 55) score += 14;
        return clamp(score);
    }

    private int pullbackEfficiency(IntelligenceSignalContext ctx) {
        double depth = ctx.vwapDistance() != null ? Math.abs(ctx.vwapDistance()) : 0;
        int score = 28;
        if (depth < 0.005) score += 28;
        else if (depth < 0.01) score += 22;
        else if (depth < 0.018) score += 15;
        if (ctx.vwapDistance() != null && ctx.vwapDistance() >= 0) score += 15;
        if (depth > 0.04) score -= 22;
        return clamp(score);
    }

    private int compressionEnergy(IntelligenceSignalContext ctx) {
        double vol = ctx.volatility() != null ? ctx.volatility() : 0.02;
        double depth = ctx.vwapDistance() != null ? Math.abs(ctx.vwapDistance()) : 0;
        int score = 30;
        if (vol < 0.015) score += 22;
        else if (vol < 0.025) score += 15;
        if (depth < 0.012) score += 20;
        if (ctx.rvol() != null && ctx.rvol() >= 2) score += 15;
        return clamp(score);
    }

    private int extensionHealth(IntelligenceSignalContext ctx) {
        double rvol = ctx.rvol() != null ? ctx.rvol() : 0;
        double structure = ctx.trendAlignment() != null ? ctx.trendAlignment() : 0;
        int score = 40;
        if (!Boolean.TRUE.equals(ctx.extended())) score += 25;
        else if (rvol >= 2.5 && structure >= 58) score += 22;
        else score -= 10;
        if (ctx.vwapDistance() != null && ctx.vwapDistance() >= 0 && ctx.vwapDistance() < 0.035) score += 15;
        return clamp(score);
    }

    private int exhaustionDrift(IntelligenceSignalContext ctx) {
        int risk = 18;
        if (Boolean.TRUE.equals(ctx.extended()) && (ctx.rvol() == null || ctx.rvol() < 1.5)) risk += 28;
        if (ctx.vwapDistance() != null && ctx.vwapDistance() > 0.045) risk += 20;
        if (isChop(ctx.marketRegime())) risk += 15;
        return clamp(risk);
    }

    private int persistence(IntelligenceSignalContext ctx) {
        return continuationPersistence(ctx);
    }

    private int vwapScore(IntelligenceSignalContext ctx) {
        int score = 25;
        if (ctx.vwapDistance() != null && ctx.vwapDistance() >= 0) score += 20;
        int persist = vwapPersistenceMinutes(ctx);
        if (persist >= 30) score += 22;
        else if (persist >= 15) score += 14;
        if (ctx.rvol() != null && ctx.rvol() >= 2) score += 12;
        return clamp(score);
    }

    private int orbScore(IntelligenceSignalContext ctx) {
        int mins = ctx.sessionTimeMinutes() != null ? ctx.sessionTimeMinutes() : 999;
        if (mins > 45) return 0;
        int score = 20;
        if (mins <= 15) score += 18;
        if (ctx.rvol() != null && ctx.rvol() >= 2.5) score += 22;
        if (ctx.trendAlignment() != null && ctx.trendAlignment() >= 60) score += 18;
        return clamp(score);
    }

    private int reclaimScore(IntelligenceSignalContext ctx, Scores s) {
        double depth = ctx.vwapDistance() != null ? Math.abs(ctx.vwapDistance()) : 0;
        if (depth > 0.025) return 0;
        return clamp((int) (s.continuationVelocity() * 0.5 + s.pullbackEfficiency() * 0.35
                + (ctx.rvol() != null ? ctx.rvol() * 5 : 0)));
    }

    private int resumptionScore(IntelligenceSignalContext ctx, Scores s) {
        int mins = ctx.sessionTimeMinutes() != null ? ctx.sessionTimeMinutes() : 0;
        if (mins < 45) return 0;
        return clamp((int) (s.compressionEnergy() * 0.4 + s.continuationIntegrity() * 0.35 + s.extensionHealth() * 0.25));
    }

    private String detectRegime(IntelligenceSignalContext ctx, Scores s) {
        if (s.exhaustionDrift() >= 72) return "LATE_EXHAUSTION";
        if (isChop(ctx.marketRegime()) && s.continuationIntegrity() < 45) return "CHOP_INSTABILITY";
        if (s.expansionProbability() >= 78 && s.continuationVelocity() >= 70) return "EXPLOSIVE_CONTINUATION";
        if (s.continuationVelocity() >= 65 && inEarlyWindow(ctx.sessionTimeMinutes())) return "EARLY_ACCELERATION";
        if (s.pullbackEfficiency() >= 62) return "SHALLOW_PULLBACK_CONTINUATION";
        if (ctx.vwapDistance() != null && ctx.vwapDistance() >= 0) return "VWAP_ACCEPTANCE_PERSISTENCE";
        return "INSTITUTIONAL_PERSISTENCE";
    }

    private String classify(String regime, Scores s, IntelligenceSignalContext ctx) {
        return switch (regime) {
            case "EXPLOSIVE_CONTINUATION" -> "EXPLOSIVE_CONTINUATION";
            case "LATE_EXHAUSTION" -> "LATE_STAGE_EXHAUSTION";
            case "CHOP_INSTABILITY" -> "CHOP_UNSTABLE";
            case "SHALLOW_PULLBACK_CONTINUATION" -> "HEALTHY_PULLBACK";
            case "EARLY_ACCELERATION" -> "REACCELERATION_READY";
            default -> Boolean.TRUE.equals(ctx.extended()) && s.continuationIntegrity() >= 58
                    ? "EXTENDED_BUT_HEALTHY" : "PERSISTENT_TREND";
        };
    }

    private String traderAction(String type, boolean add) {
        if (add && type.contains("COMPRESSION")) return "ADD_ON_COMPRESSION_BREAKOUT";
        return switch (type) {
            case "DIRECT_CONTINUATION_ENTRY", "ACCELERATION_RECLAIM" -> "EARLY_CONTINUATION_ENTRY";
            case "SHALLOW_PULLBACK_ENTRY" -> "HEALTHY_SHALLOW_PULLBACK";
            case "VWAP_PERSISTENCE_ENTRY" -> "VWAP_HOLD_CONTINUATION";
            case "MICRO_COMPRESSION_BREAKOUT", "ORB_CONTINUATION_ADD" -> "ADD_ON_COMPRESSION_BREAKOUT";
            case "TREND_RESUMPTION_ENTRY" -> "TREND_RESUMPTION_READY";
            default -> "EARLY_CONTINUATION_ENTRY";
        };
    }

    private String chartZone(String type, Scores s) {
        if (s.exhaustionDrift() >= 65) return "EXHAUSTION_DEVELOPING";
        return switch (type) {
            case "SHALLOW_PULLBACK_ENTRY" -> "SHALLOW_PULLBACK_HOLD";
            case "MICRO_COMPRESSION_BREAKOUT" -> "COMPRESSION_BREAKOUT";
            case "VWAP_PERSISTENCE_ENTRY" -> "VWAP_PERSISTENCE";
            default -> "CONTINUATION_ENTRY";
        };
    }

    private TriggerResult inactive(String action, String zone, int score, String reason, boolean active) {
        return new TriggerResult("", "", "", action, score, zone, false, reason, reason, active);
    }

    private String triggerReason(String type, Scores s, IntelligenceSignalContext ctx) {
        double rvol = ctx.rvol() != null ? ctx.rvol() : 0;
        return type.replace('_', ' ') + " · integrity " + s.continuationIntegrity()
                + " · RVOL " + String.format("%.1f", rvol) + "x · " + windowLabel(ctx.sessionTimeMinutes());
    }

    private String whyValid(String type, Scores s, IntelligenceSignalContext ctx) {
        if ("SHALLOW_PULLBACK_ENTRY".equals(type)) {
            return "Shallow PB held above VWAP — efficiency " + s.pullbackEfficiency() + "%";
        }
        if ("VWAP_PERSISTENCE_ENTRY".equals(type)) {
            return "VWAP maintained " + vwapPersistenceMinutes(ctx) + "m — pressure " + s.institutionalPressure() + "%";
        }
        return "Continuation intact · velocity " + s.continuationVelocity() + "% · extension health " + s.extensionHealth() + "%";
    }

    public static int vwapPersistenceMinutes(IntelligenceSignalContext ctx) {
        int mins = ctx.sessionTimeMinutes() != null ? ctx.sessionTimeMinutes() : 0;
        double vwap = ctx.vwapDistance() != null ? ctx.vwapDistance() : 0;
        if (vwap >= 0 && mins > 5) return Math.min(120, (int) Math.round(mins * 0.85));
        return Math.max(0, (int) Math.round(mins * 0.4));
    }

    public static String markerColor(String chartZone) {
        return switch (chartZone) {
            case "CONTINUATION_ENTRY" -> "#34d399";
            case "SHALLOW_PULLBACK_HOLD" -> "#fbbf24";
            case "COMPRESSION_BREAKOUT" -> "#60a5fa";
            case "VWAP_PERSISTENCE" -> "#a78bfa";
            case "EXTENSION_WARNING" -> "#fb923c";
            default -> "#f87171";
        };
    }

    public static String markerText(String type, int score) {
        String label = switch (type) {
            case "DIRECT_CONTINUATION_ENTRY" -> "CONT ENTRY";
            case "SHALLOW_PULLBACK_ENTRY" -> "SHALLOW PB";
            case "VWAP_PERSISTENCE_ENTRY" -> "VWAP HOLD";
            case "MICRO_COMPRESSION_BREAKOUT" -> "COMPRESS";
            case "ORB_CONTINUATION_ADD" -> "ORB ADD";
            case "ACCELERATION_RECLAIM" -> "RECLAIM";
            case "TREND_RESUMPTION_ENTRY" -> "RESUME";
            default -> "TRIGGER";
        };
        return label + "\n" + score + "%";
    }

    private static String windowLabel(Integer mins) {
        if (mins == null) return "session";
        if (mins <= 15) return "9:35–10:15 opening continuation";
        if (mins <= 45) return "10:15–11:00 shallow pullback persistence";
        if (mins <= 120) return "midday compression release";
        return "trend resumption after digestion";
    }

    private static int regimeBoost(String regime) {
        if (regime == null) return 0;
        if ("TREND".equalsIgnoreCase(regime)) return 10;
        if ("BREAKOUT".equalsIgnoreCase(regime)) return 8;
        return 0;
    }

    private static boolean isChop(String regime) {
        return regime != null && (regime.equalsIgnoreCase("CHOP") || regime.equalsIgnoreCase("CHOPPY"));
    }

    private static boolean inContinuationWindow(Integer mins) {
        return mins == null || (mins >= 5 && mins <= 90);
    }

    private static boolean inEarlyWindow(Integer mins) {
        return mins != null && mins <= 45;
    }

    private static int clamp(int v) {
        return Math.max(0, Math.min(100, v));
    }
}
