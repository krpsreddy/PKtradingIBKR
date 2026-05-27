package com.tradingbot.livetrader;

import com.tradingbot.paper.PaperExecutionMode;
import com.tradingbot.paper.PaperExecutionStateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** Phase 185/185B — lightweight live screener + operational trader API. */
@RestController
@RequestMapping("/api/live-trader")
@RequiredArgsConstructor
public class LiveTraderController {

    private final LiveTraderSnapshotService snapshotService;
    private final LiveTraderRuntimeState runtimeState;
    private final PaperExecutionStateService paperExecutionStateService;

    @GetMapping("/tier1")
    public LiveTraderDtos.Tier1SnapshotDto tier1() {
        return snapshotService.tier1();
    }

    @GetMapping("/snapshot")
    public LiveTraderDtos.LiveTraderSnapshotDto snapshot() {
        return snapshotService.fullSnapshot();
    }

    @GetMapping("/runtime")
    public LiveTraderDtos.RuntimeControlsDto runtime() {
        return runtimeState.snapshot();
    }

    @PutMapping("/runtime")
    public LiveTraderDtos.RuntimeControlsDto setRuntime(@RequestBody LiveTraderDtos.SetRuntimeControlsRequest request) {
        if (request != null && request.executionMode() != null) {
            PaperExecutionMode mode = request.executionMode();
            if (mode.isLiveFamily() || mode == PaperExecutionMode.PAPER_SELECTIVE) {
                throw new IllegalArgumentException(mode + " not enabled");
            }
            paperExecutionStateService.setMode(mode);
        }
        runtimeState.apply(request);
        return runtimeState.snapshot();
    }

    @PostMapping("/telegram/test")
    public LiveTraderDtos.TelegramTickResultDto testTelegram() {
        var tier1 = snapshotService.tier1();
        if (tier1.dominant() == null) {
            return new LiveTraderDtos.TelegramTickResultDto(false, "TEST", null, "no dominant");
        }
        return snapshotService.testTelegram(tier1.dominant());
    }
}
