package com.tradingbot.ai.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.ai.dto.AiDtos.*;
import com.tradingbot.ai.dto.SymbolEdgeDtos.SymbolEdgeAiAnalysisDto;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;

@Slf4j
public abstract class AbstractGenerateAiProvider implements AiProvider {

    protected final ObjectMapper objectMapper = new ObjectMapper();

    protected abstract String generate(String prompt);

    public AiExecutionResponseDto analyzeExecutionWithPrompt(String prompt) {
        long start = System.currentTimeMillis();
        try {
            return parseExecution(id(), System.currentTimeMillis() - start, generate(prompt), false);
        } catch (Exception e) {
            log.warn("{} execution failed: {}", id(), e.getMessage());
            return unavailableExecution(start);
        }
    }

    public OpenStructureResponseDto analyzeOpenStructureWithPrompt(String prompt) {
        long start = System.currentTimeMillis();
        try {
            return parseOpenStructure(id(), System.currentTimeMillis() - start, generate(prompt));
        } catch (Exception e) {
            log.warn("{} open structure failed: {}", id(), e.getMessage());
            return unavailableOpenStructure(start);
        }
    }

    public CoachingResponseDto generateCoachingWithPrompt(String prompt) {
        long start = System.currentTimeMillis();
        try {
            return parseCoaching(id(), System.currentTimeMillis() - start, generate(prompt));
        } catch (Exception e) {
            log.warn("{} coaching failed: {}", id(), e.getMessage());
            return unavailableCoaching(start);
        }
    }

    public SymbolEdgeAiAnalysisDto analyzeSymbolEdgeWithPrompt(String prompt) {
        long start = System.currentTimeMillis();
        try {
            return parseSymbolEdge(id(), System.currentTimeMillis() - start, generate(prompt), false);
        } catch (Exception e) {
            log.warn("{} symbol edge failed: {}", id(), e.getMessage());
            return unavailableSymbolEdge(start);
        }
    }

    protected AiExecutionResponseDto parseExecution(String providerId, long latencyMs, String raw, boolean fallback) {
        JsonNode node = parseJson(raw);
        if (node == null) {
            return AiExecutionResponseDto.builder()
                    .provider(providerId)
                    .latencyMs(latencyMs)
                    .available(true)
                    .fallbackUsed(true)
                    .summary(truncate(raw, 200))
                    .reasoning(List.of("Model output was not valid JSON."))
                    .compactLine("AI · REVIEW DETERMINISTIC PANEL")
                    .warnings(List.of("Parse fallback"))
                    .build();
        }
        AiExecutionResponseDto dto = AiExecutionResponseDto.builder()
                .provider(providerId)
                .latencyMs(latencyMs)
                .available(true)
                .fallbackUsed(fallback)
                .continuationProbability(dbl(node, "continuationProbability"))
                .fakeoutProbability(dbl(node, "fakeoutProbability"))
                .entryQuality(text(node, "entryQuality"))
                .recommendedAction(text(node, "recommendedAction"))
                .suggestedEntry(text(node, "suggestedEntry"))
                .reasoning(stringList(node, "reasoning"))
                .confidence(dbl(node, "confidence"))
                .summary(text(node, "summary"))
                .build();
        return dto.toBuilder().compactLine(AiCompactLineFormatter.execution(dto)).build();
    }

    protected OpenStructureResponseDto parseOpenStructure(String providerId, long latencyMs, String raw) {
        JsonNode node = parseJson(raw);
        if (node == null) {
            return OpenStructureResponseDto.builder()
                    .provider(providerId)
                    .latencyMs(latencyMs)
                    .available(true)
                    .fallbackUsed(true)
                    .classification("UNKNOWN")
                    .structureAssessment(truncate(raw, 160))
                    .entryTimingGuidance("Use engine triggers.")
                    .compactLine("AI · OPEN CLASSIFICATION UNAVAILABLE")
                    .warnings(List.of("Parse fallback"))
                    .build();
        }
        OpenStructureResponseDto dto = OpenStructureResponseDto.builder()
                .provider(providerId)
                .latencyMs(latencyMs)
                .available(true)
                .fallbackUsed(false)
                .classification(text(node, "classification"))
                .structureAssessment(text(node, "structureAssessment"))
                .entryTimingGuidance(text(node, "entryTimingGuidance"))
                .confidence(dbl(node, "confidence"))
                .build();
        return dto.toBuilder().compactLine(AiCompactLineFormatter.openStructure(dto)).build();
    }

    protected SymbolEdgeAiAnalysisDto parseSymbolEdge(String providerId, long latencyMs, String raw, boolean fallback) {
        JsonNode node = parseJson(raw);
        if (node == null) {
            return SymbolEdgeAiAnalysisDto.builder()
                    .strengths(List.of())
                    .weaknesses(List.of(truncate(raw, 160)))
                    .bestConditions(List.of())
                    .avoidConditions(List.of())
                    .optimizationSuggestions(List.of("Review deterministic stats — AI parse fallback."))
                    .executionNotes(List.of("Analytics only — human approval required."))
                    .confidence("LOW")
                    .confidenceScore(0.3)
                    .summary("AI output was not valid JSON.")
                    .build();
        }
        return SymbolEdgeAiAnalysisDto.builder()
                .strengths(stringList(node, "strengths"))
                .weaknesses(stringList(node, "weaknesses"))
                .bestConditions(stringList(node, "bestConditions"))
                .avoidConditions(stringList(node, "avoidConditions"))
                .optimizationSuggestions(stringList(node, "optimizationSuggestions"))
                .executionNotes(stringList(node, "executionNotes"))
                .confidence(text(node, "confidence"))
                .confidenceScore(dbl(node, "confidenceScore"))
                .summary(text(node, "summary"))
                .build();
    }

    private SymbolEdgeAiAnalysisDto unavailableSymbolEdge(long start) {
        return SymbolEdgeAiAnalysisDto.builder()
                .strengths(List.of())
                .weaknesses(List.of("AI provider unavailable"))
                .bestConditions(List.of())
                .avoidConditions(List.of())
                .optimizationSuggestions(List.of())
                .executionNotes(List.of("Use deterministic edge stats only."))
                .confidence("LOW")
                .confidenceScore(0.2)
                .summary("Provider unavailable")
                .build();
    }

    protected CoachingResponseDto parseCoaching(String providerId, long latencyMs, String raw) {
        JsonNode node = parseJson(raw);
        if (node == null) {
            return CoachingResponseDto.builder()
                    .provider(providerId)
                    .latencyMs(latencyMs)
                    .available(true)
                    .fallbackUsed(true)
                    .headline("Coaching parse fallback")
                    .suggestions(List.of(truncate(raw, 120)))
                    .psychologyNotes(List.of())
                    .build();
        }
        return CoachingResponseDto.builder()
                .provider(providerId)
                .latencyMs(latencyMs)
                .available(true)
                .fallbackUsed(false)
                .headline(text(node, "headline"))
                .suggestions(stringList(node, "suggestions"))
                .psychologyNotes(stringList(node, "psychologyNotes"))
                .confidence(dbl(node, "confidence"))
                .build();
    }

    private AiExecutionResponseDto unavailableExecution(long start) {
        return AiExecutionResponseDto.builder()
                .provider(id())
                .latencyMs(System.currentTimeMillis() - start)
                .available(false)
                .fallbackUsed(true)
                .summary("Provider unavailable")
                .compactLine("")
                .warnings(List.of("AI provider unavailable"))
                .reasoning(List.of())
                .build();
    }

    private OpenStructureResponseDto unavailableOpenStructure(long start) {
        return OpenStructureResponseDto.builder()
                .provider(id())
                .latencyMs(System.currentTimeMillis() - start)
                .available(false)
                .fallbackUsed(true)
                .classification("UNAVAILABLE")
                .structureAssessment("")
                .entryTimingGuidance("")
                .compactLine("")
                .warnings(List.of("AI provider unavailable"))
                .build();
    }

    private CoachingResponseDto unavailableCoaching(long start) {
        return CoachingResponseDto.builder()
                .provider(id())
                .latencyMs(System.currentTimeMillis() - start)
                .available(false)
                .fallbackUsed(true)
                .headline("")
                .suggestions(List.of())
                .psychologyNotes(List.of())
                .build();
    }

    private JsonNode parseJson(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            String trimmed = raw.trim();
            int start = trimmed.indexOf('{');
            int end = trimmed.lastIndexOf('}');
            if (start >= 0 && end > start) trimmed = trimmed.substring(start, end + 1);
            return objectMapper.readTree(trimmed);
        } catch (Exception e) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asText("") : "";
    }

    private static Double dbl(JsonNode node, String field) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) return null;
        return v.isNumber() ? v.asDouble() : null;
    }

    private static List<String> stringList(JsonNode node, String field) {
        JsonNode arr = node.get(field);
        if (arr == null || !arr.isArray()) return List.of();
        List<String> out = new ArrayList<>();
        arr.forEach(n -> out.add(n.asText("")));
        return out;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
