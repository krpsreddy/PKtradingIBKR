package com.tradingbot.intelligence.snapshot;

import com.tradingbot.intelligence.snapshot.dto.IntelligenceSnapshotDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Phase 164 — backend intelligence offload APIs. */
@RestController
@RequiredArgsConstructor
public class IntelligenceOffloadController {

    private final IntelligenceSnapshotService snapshotService;

    @GetMapping("/api/live-regime/{symbol}")
    public LiveRegimeSnapshotDto liveRegime(
            @PathVariable String symbol,
            @RequestParam(required = false) Integer lookbackDays
    ) {
        return snapshotService.liveRegime(symbol, lookbackDays);
    }

    @GetMapping("/api/execution-cards/{symbol}")
    public ExecutionCardsSnapshotDto executionCards(
            @PathVariable String symbol,
            @RequestParam(required = false) Integer lookbackDays
    ) {
        return snapshotService.executionCards(symbol, lookbackDays);
    }

    @GetMapping("/api/replay-trigger/{symbol}/{session}")
    public ReplayTriggerSnapshotDto replayTrigger(
            @PathVariable String symbol,
            @PathVariable String session
    ) {
        return snapshotService.replayTrigger(symbol, session);
    }

    @GetMapping("/api/replay-timeline/{symbol}/{session}")
    public ReplayTimelineSnapshotDto replayTimeline(
            @PathVariable String symbol,
            @PathVariable String session
    ) {
        return snapshotService.replayTimeline(symbol, session);
    }

    @GetMapping("/api/scanner/opportunities")
    public ScannerSnapshotDto scannerOpportunities(
            @RequestParam List<String> symbols,
            @RequestParam(required = false) Integer lookbackDays
    ) {
        return snapshotService.scannerOpportunities(symbols, lookbackDays);
    }
}
