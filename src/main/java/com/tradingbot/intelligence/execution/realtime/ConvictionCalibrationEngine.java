package com.tradingbot.intelligence.execution.realtime;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Phase 169 — spreads conviction scores with rarity/velocity/persistence multipliers. */
public final class ConvictionCalibrationEngine {

    private ConvictionCalibrationEngine() {}

    public record CalibrationInput(
            int continuationIntegrity,
            int rvolSustainment,
            int persistenceDuration,
            int pullbackEfficiency,
            int accelerationIntegrity,
            int vwapAcceptance,
            int structureQuality,
            int expansionProbability,
            int exhaustionPenalty,
            int volatilityInstability,
            int convictionVelocity,
            int popVelocity,
            int opportunityAgeSeconds
    ) {}

    public record CalibrationResult(
            int convictionScore,
            int urgencyScore,
            int rarityScore,
            int persistenceScore,
            int confidenceStability,
            String percentileRank,
            double scannerPriority
    ) {}

    public static CalibrationResult calibrate(CalibrationInput input) {
        double exhaustionInverse = 100 - input.exhaustionPenalty();
        double base =
                input.continuationIntegrity() * 0.14 +
                input.rvolSustainment() * 0.12 +
                input.persistenceDuration() * 0.10 +
                input.pullbackEfficiency() * 0.08 +
                input.accelerationIntegrity() * 0.10 +
                input.vwapAcceptance() * 0.10 +
                input.structureQuality() * 0.12 +
                input.expansionProbability() * 0.14 +
                exhaustionInverse * 0.10 -
                input.volatilityInstability() * 0.08;

        int highDims = 0;
        if (input.continuationIntegrity() >= 80) highDims++;
        if (input.rvolSustainment() >= 80) highDims++;
        if (input.structureQuality() >= 80) highDims++;
        if (input.expansionProbability() >= 80) highDims++;

        int rarityScore = clamp((int) Math.round(40 + highDims * 14 + (input.expansionProbability() > 85 ? 8 : 0)));
        int persistenceScore = clamp((int) Math.round(input.persistenceDuration() * 0.55 + input.rvolSustainment() * 0.25));
        int velocity = input.convictionVelocity();
        int pop = input.popVelocity();

        double rarityMultiplier = 1 + (rarityScore - 50) / 200.0;
        double persistenceMultiplier = 1 + (persistenceScore - 45) / 180.0;
        double velocityMultiplier = 1 + Math.max(0, velocity) / 120.0 + Math.max(0, pop) / 200.0;

        double raw = base * rarityMultiplier * persistenceMultiplier * velocityMultiplier;
        if (velocity >= 12 && input.persistenceDuration() < 35) raw *= 0.88;

        int urgencyScore = clamp((int) Math.round(
                raw * 0.35 + Math.max(0, velocity) * 1.2 + Math.max(0, pop) * 0.8 +
                        (input.expansionProbability() > 75 ? 12 : 0)
        ));
        int convictionScore = clamp((int) Math.round(raw));
        double scannerPriority = urgencyScore + convictionScore * 0.4 + Math.max(0, velocity) * 1.5;

        return new CalibrationResult(
                convictionScore, urgencyScore, rarityScore, persistenceScore,
                72, "STANDARD", scannerPriority
        );
    }

    public static List<CalibrationResult> calibrateCohort(List<CalibrationInput> inputs) {
        List<CalibrationResult> raw = new ArrayList<>();
        for (CalibrationInput in : inputs) raw.add(calibrate(in));

        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < raw.size(); i++) order.add(i);
        order.sort(Comparator.comparingDouble((Integer i) -> raw.get(i).scannerPriority()).reversed());

        int[] spreadBands = {98, 95, 92, 88, 85, 82, 78, 72, 68, 65};
        int n = raw.size();
        List<CalibrationResult> out = new ArrayList<>(raw);

        for (int rank = 0; rank < order.size(); rank++) {
            int idx = order.get(rank);
            CalibrationResult r = raw.get(idx);
            int bandIdx = n <= 1 ? 0 : Math.min(spreadBands.length - 1, (rank * spreadBands.length) / n);
            int spreadScore = spreadBands[bandIdx];
            int blended = clamp((int) Math.round(r.convictionScore() * 0.35 + spreadScore * 0.65));
            double priority = blended + r.urgencyScore() * 0.35;
            String percentile = percentileFromRank(rank, n);
            out.set(idx, new CalibrationResult(
                    blended, r.urgencyScore(), r.rarityScore(), r.persistenceScore(),
                    r.confidenceStability(), percentile, priority
            ));
        }
        return out;
    }

    public static CalibrationInput fromScoreContext(
            int triggerIntegrity,
            int expansionProbability,
            int persistenceSeconds,
            int exhaustionPenalty,
            int convictionVelocity,
            boolean preConfirmation
    ) {
        int persistScaled = clamp(persistenceSeconds * 3 + triggerIntegrity / 2);
        return new CalibrationInput(
                triggerIntegrity,
                expansionProbability,
                persistScaled,
                triggerIntegrity,
                expansionProbability,
                triggerIntegrity,
                triggerIntegrity,
                expansionProbability,
                exhaustionPenalty,
                preConfirmation ? 35 : 15,
                convictionVelocity,
                convictionVelocity >= 8 ? convictionVelocity : 0,
                persistenceSeconds
        );
    }

    private static String percentileFromRank(int rankIdx, int n) {
        if (n <= 1) return "TOP_1";
        double pct = (double) rankIdx / n;
        if (pct <= 0.01) return "TOP_1";
        if (pct <= 0.05) return "TOP_5";
        if (pct <= 0.10) return "TOP_10";
        if (pct >= 0.75) return "WEAK";
        return "STANDARD";
    }

    private static int clamp(int v) {
        return Math.max(0, Math.min(100, v));
    }
}
