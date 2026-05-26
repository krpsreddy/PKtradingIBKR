package com.tradingbot.ai.provider;

import com.tradingbot.ai.dto.AiDtos.*;
import com.tradingbot.ai.dto.SymbolEdgeDtos.SymbolEdgeAiAnalysisDto;
import com.tradingbot.ai.dto.SymbolEdgeDtos.SymbolEdgeCompressedDto;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class NoOpAiProvider extends AbstractGenerateAiProvider {

    @Override
    public String id() {
        return "noop";
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    protected String generate(String prompt) {
        return "";
    }

    public AiExecutionResponseDto analyzeFromDeterministic(AiExecutionRequestDto req) {
        long start = System.currentTimeMillis();
        String quality = mapQuality(req);
        String action = req.getFakeoutRisk() != null && req.getFakeoutRisk() >= 45 ? "WAIT"
                : (req.getExpectancyR() > 0.3 ? "WAIT" : "AVOID");
        if ("READY".equals(req.getCurrentState()) || "TRIGGERED".equals(req.getCurrentState())) {
            action = req.getFakeoutRisk() != null && req.getFakeoutRisk() >= 50 ? "WAIT" : "ENTER";
        }
        double fakeout = req.getFakeoutRisk() != null ? req.getFakeoutRisk() / 100.0 : 0.2;
        double cont = Math.min(0.95, Math.max(0.05, req.getHistoricalWinRate() / 100.0));

        List<String> reasoning = new ArrayList<>();
        reasoning.add(String.format(Locale.US, "Deterministic expectancy %+.2fR", req.getExpectancyR()));
        reasoning.add(String.format(Locale.US, "Win rate %.0f%% in %s", req.getHistoricalWinRate(), req.getMarketRegime()));
        if (req.getFakeoutRisk() != null && req.getFakeoutRisk() >= 40) {
            reasoning.add("Elevated fakeout signature — patience favored");
        }

        AiExecutionResponseDto dto = AiExecutionResponseDto.builder()
                .provider(id())
                .latencyMs(System.currentTimeMillis() - start)
                .available(true)
                .fallbackUsed(true)
                .continuationProbability(cont)
                .fakeoutProbability(fakeout)
                .entryQuality(quality)
                .recommendedAction(action)
                .suggestedEntry(req.getSignalType())
                .reasoning(reasoning)
                .confidence(0.55)
                .summary(String.format("%s %s — deterministic engines primary", req.getSymbol(), req.getSignalType()))
                .warnings(List.of("AI reasoning layer inactive — deterministic fallback"))
                .build();
        return dto.toBuilder().compactLine(AiCompactLineFormatter.execution(dto)).build();
    }

    public OpenStructureResponseDto analyzeOpenStructureDeterministic(OpenStructureRequestDto req) {
        long start = System.currentTimeMillis();
        String classification = req.getOpenCandidateCount() > 2 ? "TREND_OPEN" : "CHOP_OPEN";
        OpenStructureResponseDto dto = OpenStructureResponseDto.builder()
                .provider(id())
                .latencyMs(System.currentTimeMillis() - start)
                .available(true)
                .fallbackUsed(true)
                .classification(classification)
                .structureAssessment(req.getOpenCandidateCount() + " open candidates scanned")
                .entryTimingGuidance("Confirm with OPEN_MOM engines before entry")
                .confidence(0.5)
                .warnings(List.of("Deterministic open classification"))
                .build();
        return dto.toBuilder().compactLine(AiCompactLineFormatter.openStructure(dto)).build();
    }

    public CoachingResponseDto generateCoachingDeterministic(CoachingRequestDto req) {
        long start = System.currentTimeMillis();
        List<String> suggestions = req.getBehaviorHighlights() != null && !req.getBehaviorHighlights().isEmpty()
                ? req.getBehaviorHighlights().stream().limit(3).toList()
                : List.of("Review session in Review workspace for edge analytics.");
        return CoachingResponseDto.builder()
                .provider(id())
                .latencyMs(System.currentTimeMillis() - start)
                .available(true)
                .fallbackUsed(true)
                .headline("Deterministic coaching mode")
                .suggestions(suggestions)
                .psychologyNotes(List.of(
                        "Most failed trades often cluster in CHOP regimes.",
                        "Late entries reduce expectancy — honor freshness labels."))
                .confidence(0.5)
                .build();
    }

    public SymbolEdgeAiAnalysisDto analyzeSymbolEdgeDeterministic(SymbolEdgeCompressedDto data) {
        long start = System.currentTimeMillis();
        List<String> strengths = new ArrayList<>();
        List<String> weaknesses = new ArrayList<>();
        List<String> best = new ArrayList<>();
        List<String> avoid = new ArrayList<>();
        List<String> optimize = new ArrayList<>();

        if (data.getBestSetup() != null && data.getBestSetup().getExpectancy() > 0) {
            strengths.add(String.format(Locale.US, "%s strongest setup (+%.2fR expectancy, n=%d)",
                    data.getBestSetup().getType(), data.getBestSetup().getExpectancy(), data.getBestSetup().getSample()));
            best.add(data.getBestSetup().getType() + " in favorable regime");
        }
        if (data.getWorstSetup() != null && data.getWorstSetup().getExpectancy() < 0) {
            weaknesses.add(String.format(Locale.US, "%s underperforms (%.2fR expectancy)",
                    data.getWorstSetup().getType(), data.getWorstSetup().getExpectancy()));
            avoid.add(data.getWorstSetup().getType() + " without confirmation");
        }
        if (data.getWorstRegime() != null && data.getWorstRegime().getExpectancy() < 0) {
            weaknesses.add(String.format(Locale.US, "%s regime destroys expectancy (%.2fR)",
                    data.getWorstRegime().getName(), data.getWorstRegime().getExpectancy()));
            avoid.add("Momentum entries during " + data.getWorstRegime().getName());
            optimize.add("Suppress breakout entries during " + data.getWorstRegime().getName());
        }
        if (data.getBestRegime() != null && data.getBestRegime().getExpectancy() > 0) {
            strengths.add(String.format(Locale.US, "%s regime continuation reliable (+%.2fR)",
                    data.getBestRegime().getName(), data.getBestRegime().getExpectancy()));
        }
        if (data.getBestTimeWindow() != null && !"—".equals(data.getBestTimeWindow())) {
            strengths.add("Best continuation window: " + data.getBestTimeWindow());
            best.add("Entries between " + data.getBestTimeWindow());
        }
        if (data.getLateEntryPenalty() != null && data.getLateEntryPenalty().getExpectancyDropPct() > 15) {
            weaknesses.add(String.format(Locale.US, "Late entries reduce expectancy by %.0f%%",
                    data.getLateEntryPenalty().getExpectancyDropPct()));
            optimize.add("Prioritize READY/TRIGGERED entries over ENTERED stage");
        }
        if (data.getPremarketExtension() != null) {
            data.getPremarketExtension().forEach((bucket, stat) -> {
                if (stat.getFailureRate() != null && stat.getFailureRate() >= 60 && stat.getSample() >= 5) {
                    weaknesses.add(String.format(Locale.US, "Premarket extension %s: %.0f%% failure rate",
                            bucket, stat.getFailureRate()));
                    avoid.add("Opening spikes after " + bucket + " premarket extension");
                }
            });
        }
        if (strengths.isEmpty()) {
            strengths.add("Insufficient evaluated history — collect more signal intelligence samples.");
        }
        if (optimize.isEmpty()) {
            optimize.add("Review setup×regime matrix before changing thresholds.");
        }

        String conf = data.getOverall() != null ? data.getOverall().getConfidence() : "LOW";
        double confScore = switch (conf) {
            case "VERY_HIGH" -> 0.88;
            case "HIGH" -> 0.72;
            case "MEDIUM" -> 0.55;
            default -> 0.35;
        };

        return SymbolEdgeAiAnalysisDto.builder()
                .strengths(strengths)
                .weaknesses(weaknesses)
                .bestConditions(best)
                .avoidConditions(avoid)
                .optimizationSuggestions(optimize)
                .executionNotes(List.of(
                        "Analytics only — no automatic strategy changes.",
                        "Human approval required for all threshold adjustments."))
                .confidence(conf)
                .confidenceScore(confScore)
                .summary(String.format(Locale.US, "%s — %d-day deterministic edge analysis (fallback mode)",
                        data.getSymbol(), data.getLookbackDays()))
                .build();
    }

    private static String mapQuality(AiExecutionRequestDto req) {
        if (req.getPremarketExtension() >= 8 && req.getRvol() >= 4) return "LATE";
        if (req.getExpectancyR() < 0) return "AVOID";
        if (req.getEntryDistanceFromVWAP() > 1.5) return "CHASE";
        if (req.getHistoricalWinRate() >= 65) return "GOOD";
        return "GOOD";
    }
}
