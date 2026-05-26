package com.tradingbot.api;

import com.tradingbot.ai.dto.AiDtos.*;
import com.tradingbot.ai.dto.SymbolEdgeDtos.SymbolEdgeAnalysisResponseDto;
import com.tradingbot.ai.dto.SymbolEdgeDtos.SymbolEdgeCompressedDto;
import com.tradingbot.ai.service.AiCoachingIntelligenceService;
import com.tradingbot.ai.service.AiExecutionIntelligenceService;
import com.tradingbot.ai.service.AiStatusService;
import com.tradingbot.ai.service.OpenStructureAiService;
import com.tradingbot.ai.service.SignalSymbolEdgeAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiStatusService statusService;
    private final AiExecutionIntelligenceService executionIntelligenceService;
    private final OpenStructureAiService openStructureAiService;
    private final AiCoachingIntelligenceService coachingIntelligenceService;
    private final SignalSymbolEdgeAnalysisService symbolEdgeAnalysisService;

    @GetMapping("/status")
    public AiProviderStatusDto status() {
        return statusService.status();
    }

    @GetMapping("/execution/analyze")
    public AiExecutionResponseDto analyzeExecution(
            @RequestParam String symbol,
            @RequestParam(required = false) String signalType) {
        return executionIntelligenceService.analyze(symbol, signalType);
    }

    @GetMapping("/open-structure/analyze")
    public OpenStructureResponseDto analyzeOpenStructure(@RequestParam String symbol) {
        return openStructureAiService.analyze(symbol);
    }

    @GetMapping("/coaching/generate")
    public CoachingResponseDto generateCoaching(@RequestParam String symbol) {
        return coachingIntelligenceService.generate(symbol);
    }

    /** Phase 132 — symbol edge analysis from backend outcomes (analytics only). */
    @GetMapping("/symbol-analysis/{symbol}")
    public SymbolEdgeAnalysisResponseDto analyzeSymbolEdge(@PathVariable String symbol) {
        return symbolEdgeAnalysisService.analyzeFromBackend(symbol);
    }

    /** Phase 132 — symbol edge analysis from client signal intelligence summary. */
    @PostMapping("/symbol-analysis/{symbol}")
    public SymbolEdgeAnalysisResponseDto analyzeSymbolEdgeWithSummary(
            @PathVariable String symbol,
            @RequestBody SymbolEdgeCompressedDto summary) {
        String sym = summary.getSymbol() == null || summary.getSymbol().isBlank()
                ? symbol
                : summary.getSymbol();
        return symbolEdgeAnalysisService.analyzeFromClientSummary(summary.toBuilder().symbol(sym).build());
    }
}
