package com.tradingbot.ai.service;

import com.tradingbot.ai.dto.AiDtos.AiExecutionResponseDto;
import com.tradingbot.ai.dto.AiDtos.CoachingResponseDto;
import com.tradingbot.ai.dto.AiDtos.OpenStructureResponseDto;
import com.tradingbot.ai.dto.SymbolEdgeDtos.SymbolEdgeAiAnalysisDto;
import com.tradingbot.config.AiProperties;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class AiResponseValidator {

    private static final Pattern TRADE_ORDER = Pattern.compile(
            "\\b(place\\s+(an?\\s+)?order|buy\\s+now|sell\\s+now|market\\s+order)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern STOP_OVERRIDE = Pattern.compile(
            "\\b(ignore\\s+stop|remove\\s+stop|widen\\s+stop|override\\s+stop)\\b",
            Pattern.CASE_INSENSITIVE);

    private final AiProperties properties;

    public AiResponseValidator(AiProperties properties) {
        this.properties = properties;
    }

    public AiExecutionResponseDto validateExecution(AiExecutionResponseDto raw) {
        List<String> warnings = new ArrayList<>(raw.getWarnings() != null ? raw.getWarnings() : List.of());
        String action = sanitizeAction(raw.getRecommendedAction());
        if ("ENTER".equals(action)) {
            warnings.add("ENTER is advisory — deterministic execution panel is authoritative.");
        }
        List<String> reasoning = raw.getReasoning() != null
                ? raw.getReasoning().stream().map(this::sanitize).toList() : List.of();

        return raw.toBuilder()
                .recommendedAction(action)
                .summary(sanitize(raw.getSummary()))
                .suggestedEntry(sanitize(raw.getSuggestedEntry()))
                .reasoning(reasoning)
                .entryQuality(normalizeQuality(raw.getEntryQuality()))
                .warnings(warnings)
                .compactLine(raw.getCompactLine() != null ? sanitize(raw.getCompactLine()) : raw.getCompactLine())
                .build();
    }

    public OpenStructureResponseDto validateOpenStructure(OpenStructureResponseDto raw) {
        return raw.toBuilder()
                .structureAssessment(sanitize(raw.getStructureAssessment()))
                .entryTimingGuidance(sanitize(raw.getEntryTimingGuidance()))
                .classification(normalizeOpenClass(raw.getClassification()))
                .build();
    }

    public CoachingResponseDto validateCoaching(CoachingResponseDto raw) {
        return raw.toBuilder()
                .headline(sanitize(raw.getHeadline()))
                .suggestions(raw.getSuggestions() != null
                        ? raw.getSuggestions().stream().map(this::sanitize).toList() : List.of())
                .psychologyNotes(raw.getPsychologyNotes() != null
                        ? raw.getPsychologyNotes().stream().map(this::sanitize).toList() : List.of())
                .build();
    }

    public SymbolEdgeAiAnalysisDto validateSymbolEdge(SymbolEdgeAiAnalysisDto raw) {
        return raw.toBuilder()
                .summary(sanitize(raw.getSummary()))
                .strengths(sanitizeList(raw.getStrengths()))
                .weaknesses(sanitizeList(raw.getWeaknesses()))
                .bestConditions(sanitizeList(raw.getBestConditions()))
                .avoidConditions(sanitizeList(raw.getAvoidConditions()))
                .optimizationSuggestions(sanitizeList(raw.getOptimizationSuggestions()))
                .executionNotes(sanitizeList(raw.getExecutionNotes()))
                .confidence(normalizeEdgeConfidence(raw.getConfidence()))
                .build();
    }

    private List<String> sanitizeList(List<String> items) {
        return items != null ? items.stream().map(this::sanitize).filter(s -> !s.isBlank()).toList() : List.of();
    }

    private String normalizeEdgeConfidence(String c) {
        if (c == null) return "LOW";
        String u = c.toUpperCase(Locale.ROOT).replace(' ', '_');
        return switch (u) {
            case "LOW", "MEDIUM", "HIGH", "VERY_HIGH" -> u;
            default -> "LOW";
        };
    }

    private String sanitizeAction(String action) {
        if (action == null) return "WAIT";
        String u = action.toUpperCase(Locale.ROOT);
        return switch (u) {
            case "ENTER", "WAIT", "AVOID", "REDUCE_SIZE", "EXIT" -> u;
            default -> "WAIT";
        };
    }

    private String normalizeQuality(String q) {
        if (q == null) return "GOOD";
        String u = q.toUpperCase(Locale.ROOT);
        return switch (u) {
            case "IDEAL", "GOOD", "LATE", "CHASE", "AVOID" -> u;
            default -> "GOOD";
        };
    }

    private String normalizeOpenClass(String c) {
        if (c == null) return "CHOP_OPEN";
        return c.toUpperCase(Locale.ROOT).replace(' ', '_');
    }

    private String sanitize(String text) {
        if (text == null) return "";
        String t = text.trim();
        if (properties.getSafety().isBlockTradeOrders() && TRADE_ORDER.matcher(t).find()) {
            return "Advisory only — follow deterministic execution panel.";
        }
        if (properties.getSafety().isEnforceStopRespect() && STOP_OVERRIDE.matcher(t).find()) {
            return "Respect engine-defined stops.";
        }
        return t;
    }
}
