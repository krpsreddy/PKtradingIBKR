package com.tradingbot.intelligence.execution.realtime;

/** Stage 4 — autonomous execution scorer with dynamic confidence. */
public final class AutonomousExecutionScorer {

    private AutonomousExecutionScorer() {}

    public record ScoreResult(
            int conviction,
            int expansionProbability,
            int triggerIntegrity,
            ExecutionMaturityState maturity,
            ExecutionMode mode,
            boolean preConfirmation
    ) {}

    public static ScoreResult score(
            NanoAnomalyDetector.NanoAnomalyResult anomaly,
            MicroPersistenceValidator.PersistenceResult persistence,
            StructuralRegimeValidator.StructuralResult structural,
            int convictionVelocity
    ) {
        int base = anomaly.anomalyScore();
        int conviction = base + persistence.persistenceBoost() + (structural.passed() ? 12 : 0);
        conviction = Math.max(0, Math.min(100, conviction));

        int expansion = Math.min(100, base + persistence.persistenceSeconds() * 2);
        int integrity = structural.integrityScore();

        ExecutionMaturityState maturity;
        ExecutionMode mode;
        boolean preConfirmation;

        if (anomaly.opportunityType().contains("EXHAUSTION")) {
            maturity = conviction >= 50 ? ExecutionMaturityState.EXHAUSTING : ExecutionMaturityState.FAILED;
            mode = ExecutionMode.CONFIRMED;
            preConfirmation = false;
        } else if (!persistence.passed()) {
            maturity = ExecutionMaturityState.DEVELOPING;
            mode = ExecutionMode.EARLY;
            preConfirmation = true;
        } else if (!structural.passed()) {
            maturity = ExecutionMaturityState.CONFIRMING;
            mode = ExecutionMode.EARLY;
            preConfirmation = true;
        } else if (conviction >= 78) {
            maturity = ExecutionMaturityState.CONFIRMED;
            mode = ExecutionMode.CONFIRMED;
            preConfirmation = false;
        } else if (conviction >= 65) {
            maturity = ExecutionMaturityState.CONFIRMING;
            mode = ExecutionMode.EARLY;
            preConfirmation = false;
        } else {
            maturity = ExecutionMaturityState.DEVELOPING;
            mode = ExecutionMode.EARLY;
            preConfirmation = true;
        }

        if (conviction >= 85 && persistence.persistenceSeconds() >= 20) {
            maturity = ExecutionMaturityState.EXTENDED;
        }

        // Velocity boost for ranking — applied externally; maturity unchanged
        if (convictionVelocity >= 20 && maturity == ExecutionMaturityState.CONFIRMING) {
            maturity = ExecutionMaturityState.CONFIRMED;
            mode = ExecutionMode.CONFIRMED;
            preConfirmation = false;
        }

        return new ScoreResult(conviction, expansion, integrity, maturity, mode, preConfirmation);
    }
}
