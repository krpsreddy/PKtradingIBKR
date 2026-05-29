package com.tradingbot.decisiontrace;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/** Phase 201 — human-readable execution stories from structured snapshots. */
@Component
public class DecisionNarrativeBuilder {

    public String entryNarrative(EntryReasoningSnapshot s) {
        String why = s.whyNow() != null && !s.whyNow().isEmpty()
                ? s.whyNow().stream().limit(4).collect(Collectors.joining(", "))
                : "setup aligned";
        return String.format(Locale.US,
                "Entered %s during %s after %s %s. "
                        + "Persistence %d, dominance %d, velocity %s, RVOL %.1f. "
                        + "VWAP %s, session %s. %s",
                s.symbol(),
                nullToDash(s.marketStructure()),
                nullToDash(s.entryQuality()),
                nullToDash(s.regime()),
                s.persistence(),
                s.dominance(),
                nullToDash(s.velocityTrend()),
                s.rvol(),
                nullToDash(s.vwapRelation()),
                nullToDash(s.sessionPhase()),
                why);
    }

    public String exitNarrative(ExitReasoningSnapshot s) {
        return String.format(Locale.US,
                "Exited %s because %s. "
                        + "Persistence %d→%d, dominance %d, velocity trend %s. "
                        + "Capture %.0f%%, hold %ds, realized R %s. %s",
                s.symbol(),
                nullToDash(s.exitState()),
                s.persistenceAtEntry(),
                s.persistenceAtExit(),
                s.dominanceAtExit(),
                nullToDash(s.velocityTrend()),
                s.continuationCapturePct() != null ? s.continuationCapturePct() : 0,
                s.holdDurationSec() != null ? s.holdDurationSec() : 0,
                s.realizedR() != null ? String.format(Locale.US, "%.2f", s.realizedR()) : "—",
                nullToDash(s.trendQualityNote()));
    }

    public String suppressionNarrative(SuppressionReasoningSnapshot s) {
        String verb = s.traceType() == DecisionTraceType.QUEUE ? "Queued" : "Rejected";
        return String.format(Locale.US,
                "%s %s: %s (%s). Regime %s, structure %s, entry %s, "
                        + "C=%d D=%d persist=%d RVOL=%.1f. Active=%s",
                verb,
                s.symbol(),
                nullToDash(s.rejectionCategory()),
                nullToDash(s.orchestrationState()),
                nullToDash(s.regime()),
                nullToDash(s.marketStructure()),
                nullToDash(s.entryQuality()),
                s.conviction(),
                s.dominance(),
                s.persistence(),
                s.rvol(),
                s.activeSymbol() != null ? s.activeSymbol() : "none");
    }

    public String replacementNarrative(ReplacementReasoningSnapshot s) {
        return String.format(Locale.US,
                "Replacement advisory: %s (%s) vs active %s (%s). "
                        + "Dominance gap +%d, conviction gap +%d. Incoming %s / active %s.",
                s.symbol(),
                nullToDash(s.regime()),
                s.activeSymbol(),
                nullToDash(s.activeRegime()),
                s.dominanceGap(),
                s.convictionGap(),
                nullToDash(s.incomingVelocityTrend()),
                nullToDash(s.activeVelocityTrend()));
    }

    public String fullTradeStory(EntryReasoningSnapshot entry, ExitReasoningSnapshot exit) {
        if (entry == null && exit == null) return "";
        if (exit == null) return entry != null ? entry.narrative() : "";
        if (entry == null) return exit.narrative();
        return entry.narrative() + " " + exit.narrative();
    }

    private static String nullToDash(String v) {
        return v == null || v.isBlank() ? "—" : v;
    }
}
