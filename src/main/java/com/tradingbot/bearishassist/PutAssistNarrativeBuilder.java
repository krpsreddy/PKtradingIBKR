package com.tradingbot.bearishassist;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/** Phase 202 — human-readable PUT assist stories. */
@Component
public class PutAssistNarrativeBuilder {

    public String build(
            String symbol,
            PutAssistAssessment assessment,
            String marketStructureSummary
    ) {
        if (!assessment.active()) {
            return assessment.narrative();
        }
        String reasons = assessment.reasons().isEmpty()
                ? "bearish deterioration"
                : assessment.reasons().stream().limit(5).collect(Collectors.joining(", "));
        return String.format(Locale.US,
                "Bearish PUT assist on %s: bias %d (%s), breakdown %s, structure %s. %s",
                symbol,
                assessment.bearishBias(),
                assessment.bearishState().name(),
                assessment.breakdownProbability().name(),
                marketStructureSummary != null ? marketStructureSummary : "—",
                reasons);
    }

    public String blocked(String symbol, List<String> blockReasons) {
        return String.format(Locale.US,
                "PUT assist blocked for %s: %s",
                symbol,
                blockReasons.isEmpty() ? "conditions not met" : String.join(", ", blockReasons));
    }
}
