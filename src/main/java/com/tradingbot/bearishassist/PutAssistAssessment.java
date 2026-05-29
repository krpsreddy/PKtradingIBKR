package com.tradingbot.bearishassist;

import com.tradingbot.bearish.PutAssistGrade;

import java.util.List;

/** Phase 202/209 — discretionary PUT assist advisory (recommendation only). */
public record PutAssistAssessment(
        boolean active,
        int bearishBias,
        BearishBiasState bearishState,
        BreakdownProbability breakdownProbability,
        PutAssistConfidence confidence,
        List<String> reasons,
        List<String> blockReasons,
        String narrative,
        PutAssistGrade putAssistGrade
) {
    public static PutAssistAssessment inactive(String reason) {
        return new PutAssistAssessment(
                false, 0, BearishBiasState.EARLY_WEAKNESS, BreakdownProbability.LOW,
                PutAssistConfidence.LOW, List.of(), List.of(reason), reason, PutAssistGrade.AVOID);
    }

    public static PutAssistAssessment disabled() {
        return inactive("Bearish assist mode OFF");
    }
}
