package com.tradingbot.ai.prompt;

import com.tradingbot.ai.dto.AiDtos.CoachingRequestDto;
import com.tradingbot.ai.dto.AiDtos.AiExecutionRequestDto;
import com.tradingbot.ai.dto.AiDtos.OpenStructureRequestDto;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Deterministic, token-efficient prompt construction.
 * Structured facts only — no raw candles, ticks, or chart history.
 */
@Service
public class AiPromptBuilderService {

    private static final String EXECUTION_JSON_SCHEMA = """
            Return concise JSON only:
            {"continuationProbability":0.0,"fakeoutProbability":0.0,"entryQuality":"IDEAL|GOOD|LATE|CHASE|AVOID",\
            "recommendedAction":"ENTER|WAIT|AVOID|REDUCE_SIZE|EXIT","suggestedEntry":"string",\
            "reasoning":["string"],"confidence":0.0,"summary":"string"}
            """;

    public String buildExecutionPrompt(AiExecutionRequestDto req) {
        return """
                You are an institutional scalping execution assistant.
                Deterministic engines are PRIMARY. You advise only — never place trades or override stops.

                Analyze this setup:
                Signal: %s
                Symbol: %s
                Regime: %s
                RVOL: %.1f
                Premarket extension: %.1f%%
                Trend alignment: %.0f
                Conviction: %.0f
                VWAP distance: %.2f%%
                Historical win rate: %.0f%%
                Expectancy: %+.2fR
                Fakeout risk: %s
                State: %s
                Breadth: %s
                Open type: %s

                Determine continuation probability, fakeout risk, entry quality, wait vs enter.
                %s
                """.formatted(
                req.getSignalType(),
                req.getSymbol(),
                req.getMarketRegime(),
                req.getRvol(),
                req.getPremarketExtension(),
                req.getTrendAlignment(),
                req.getConvictionScore(),
                req.getEntryDistanceFromVWAP(),
                req.getHistoricalWinRate(),
                req.getExpectancyR(),
                req.getFakeoutRisk() != null ? String.format(Locale.US, "%.0f%%", req.getFakeoutRisk()) : "—",
                req.getCurrentState(),
                nullSafe(req.getMarketBreadth()),
                nullSafe(req.getOpenType()),
                EXECUTION_JSON_SCHEMA
        );
    }

    public String buildOpenStructurePrompt(OpenStructureRequestDto req) {
        return """
                You classify the market open structure for an intraday scanner.
                Advisory only — engines remain authoritative.

                Symbol: %s
                Regime: %s
                Breadth: %s
                Open candidates: %d
                Top open type: %s
                Avg gap: %.1f%%
                Avg RVOL: %.1f

                Classify as one of: TREND_OPEN, GAP_FADE, CHOP_OPEN, SQUEEZE_OPEN, RECLAIM_OPEN, TRAP_OPEN
                Return JSON only:
                {"classification":"TREND_OPEN","structureAssessment":"string","entryTimingGuidance":"string",\
                "confidence":0.0}
                """.formatted(
                req.getSymbol(),
                req.getMarketRegime(),
                nullSafe(req.getMarketBreadth()),
                req.getOpenCandidateCount(),
                nullSafe(req.getTopOpenType()),
                req.getAvgGapPercent(),
                req.getAvgRvol()
        );
    }

    public String buildCoachingPrompt(CoachingRequestDto req) {
        String behavior = req.getBehaviorHighlights() == null || req.getBehaviorHighlights().isEmpty()
                ? "—"
                : req.getBehaviorHighlights().stream().limit(5).collect(Collectors.joining("; "));
        return """
                You provide session coaching for a disciplined intraday trader.
                No trade orders. Focus on patterns, timing, and psychology.

                Symbol context: %s
                Regime: %s
                Breadth: %s
                Behavior: %s
                Edge: %s
                Session: %s

                Return JSON only:
                {"headline":"string","suggestions":["string"],"psychologyNotes":["string"],"confidence":0.0}
                """.formatted(
                req.getSymbol(),
                req.getMarketRegime(),
                nullSafe(req.getMarketBreadth()),
                behavior,
                nullSafe(req.getEdgeSummary()),
                nullSafe(req.getSessionSummary())
        );
    }

    private static String nullSafe(String v) {
        return v == null || v.isBlank() ? "—" : v;
    }
}
