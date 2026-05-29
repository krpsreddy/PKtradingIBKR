package com.tradingbot.intelligence.live;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** REST controls for Phase 187 background hydration. */
@RestController
@RequestMapping("/api/hydration")
@RequiredArgsConstructor
public class BackgroundHydrationController {

    private final BackgroundHydrationOrchestrator orchestrator;

    @GetMapping("/controls")
    public HydrationControlsDto controls() {
        return orchestrator.controlsSnapshot();
    }

    @PutMapping("/controls")
    public HydrationControlsDto setControls(@RequestBody SetHydrationControlsRequest request) {
        if (request != null && request.enabled() != null) {
            orchestrator.setEnabled(request.enabled());
        }
        return orchestrator.controlsSnapshot();
    }
}
