package com.tradingbot.intelligence.snapshot;

import com.tradingbot.intelligence.live.LiveScannerService;
import com.tradingbot.intelligence.snapshot.dto.IntelligenceSnapshotDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Phase 164 — backend intelligence offload APIs. */
@RestController
@RequiredArgsConstructor
public class IntelligenceOffloadController {

    private final IntelligenceSnapshotService snapshotService;
    private final LiveScannerService liveScannerService;

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

    /**
     * Phase 187 — live scanner by default; {@code mode=historical} for replay analytics.
     */
    @GetMapping("/api/scanner/opportunities")
    public ScannerSnapshotDto scannerOpportunities(
            @RequestParam(required = false) List<String> symbols,
            @RequestParam(required = false) Integer lookbackDays,
            @RequestParam(defaultValue = "live") String mode
    ) {
        if ("historical".equalsIgnoreCase(mode)) {
            if (symbols == null || symbols.isEmpty()) {
                return liveScannerService.currentSnapshot();
            }
            return snapshotService.scannerOpportunities(symbols, lookbackDays);
        }
        if (symbols == null || symbols.isEmpty()) {
            return liveScannerService.currentSnapshot();
        }
        return liveScannerService.scan(symbols);
    }
}
