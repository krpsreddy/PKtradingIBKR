package com.tradingbot.api;

import com.tradingbot.api.dto.cognition.CognitionPartDtos.ReplayNarrativeDto;
import com.tradingbot.api.dto.cognition.CognitionSnapshotDto;
import com.tradingbot.intelligence.cognition.ReplayNarrativeService;
import com.tradingbot.intelligence.cognition.TraderCognitionOrchestrator;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cognition")
@RequiredArgsConstructor
public class CognitionController {

    private final TraderCognitionOrchestrator orchestrator;
    private final ReplayNarrativeService replayNarrativeService;

    @GetMapping("/snapshot")
    public CognitionSnapshotDto snapshot(@RequestParam(required = false) String symbol) {
        return orchestrator.snapshot(symbol);
    }

    @GetMapping("/replay/{symbol}")
    public ReplayNarrativeDto replayNarrative(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "0") int index) {
        return replayNarrativeService.narrate(symbol, index);
    }
}
