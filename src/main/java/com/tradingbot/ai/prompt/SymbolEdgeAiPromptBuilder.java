package com.tradingbot.ai.prompt;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.ai.dto.SymbolEdgeDtos.SymbolEdgeCompressedDto;
import org.springframework.stereotype.Service;

/**
 * Token-efficient symbol edge prompt — compressed stats only, no raw candles or ticks.
 * Analytics advisory only — never auto-modify strategies or trade.
 */
@Service
public class SymbolEdgeAiPromptBuilder {

    private static final String JSON_SCHEMA = """
            Return concise JSON only:
            {"strengths":["string"],"weaknesses":["string"],"bestConditions":["string"],\
            "avoidConditions":["string"],"optimizationSuggestions":["string"],\
            "executionNotes":["string"],"confidence":"LOW|MEDIUM|HIGH|VERY_HIGH",\
            "confidenceScore":0.0,"summary":"string"}
            """;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public String build(SymbolEdgeCompressedDto data) {
        String payload = serialize(data);
        return """
                You are a quantitative intraday trading optimization assistant.
                ANALYTICS ONLY — do not place trades, rewrite strategies, or modify thresholds automatically.
                Human approval required for all changes.

                Analyze this %d-day signal intelligence summary for symbol %s.
                Minimum samples: 10 soft, 25 medium, 50+ strong. Flag LOW CONFIDENCE when sample size is insufficient.
                Focus on expectancy, consistency, and avoiding overfitting.

                Identify:
                - strongest setup conditions
                - weakest conditions
                - failure patterns
                - best entry timing
                - best regimes
                - exhaustion behavior
                - late-entry penalties
                - optimization opportunities

                Return:
                1. top strengths
                2. biggest weaknesses
                3. recommended signal improvements (advisory only)
                4. conditions to avoid
                5. confidence level

                Keep concise and execution-focused. No storytelling.

                DATA:
                %s

                %s
                """.formatted(
                data.getLookbackDays(),
                data.getSymbol(),
                payload,
                JSON_SCHEMA
        );
    }

    private String serialize(SymbolEdgeCompressedDto data) {
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException e) {
            return "{\"symbol\":\"" + data.getSymbol() + "\",\"evaluatedTrades\":" + data.getEvaluatedTrades() + "}";
        }
    }
}
