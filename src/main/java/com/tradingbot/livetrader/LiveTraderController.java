package com.tradingbot.livetrader;

import com.tradingbot.intelligence.situational.MarketHeartbeatService;
import com.tradingbot.livetrader.execution.ExecutionSafetyService;
import com.tradingbot.ibkr.stream.DynamicLiveStreamOrchestrator;
import com.tradingbot.livetrader.portfolio.PortfolioOrchestrationService;
import com.tradingbot.paper.PaperExecutionMode;
import com.tradingbot.paper.PaperExecutionStateService;
import com.tradingbot.runtime.RuntimeExecutionSafetyGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** Phase 185/188 — lightweight live screener + operational trader API. */
@RestController
@RequestMapping("/api/live-trader")
@RequiredArgsConstructor
public class LiveTraderController {

    private final LiveTraderSnapshotService snapshotService;
    private final LiveTraderRuntimeState runtimeState;
    private final PaperExecutionStateService paperExecutionStateService;
    private final LiveTraderOperationalService operationalService;
    private final ExecutionSafetyService safetyService;
    private final PortfolioOrchestrationService portfolioOrchestrationService;
    private final MarketHeartbeatService marketHeartbeatService;
    private final DynamicLiveStreamOrchestrator streamOrchestrator;
    private final RuntimeExecutionSafetyGuard runtimeSafetyGuard;

    @GetMapping("/stream-state")
    public LiveTraderDtos.StreamStateDto streamState() {
        return streamOrchestrator.snapshot();
    }

    @GetMapping("/tier1")
    public LiveTraderDtos.Tier1SnapshotDto tier1() {
        return snapshotService.tier1();
    }

    /** Phase 187 — live scanner rankings for mobile (realtime-first, no analytics DB). */
    @GetMapping("/live-scan")
    public LiveTraderDtos.Tier1SnapshotDto liveScan(
            @RequestParam(defaultValue = "8") int limit
    ) {
        return snapshotService.liveScanTier1(Math.min(Math.max(limit, 1), 32));
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
        if (request != null) {
            runtimeSafetyGuard.validateRuntimeControlUpdate(
                    request.executionMode(),
                    request.autoExecutionEnabled()
            );
            if (request.executionMode() != null) {
                PaperExecutionMode mode = runtimeSafetyGuard.coercePaperExecutionMode(request.executionMode());
                if (mode.isLiveFamily() || mode == PaperExecutionMode.PAPER_SELECTIVE) {
                    throw new IllegalArgumentException(mode + " not enabled");
                }
                paperExecutionStateService.setMode(mode);
            }
        }
        runtimeState.apply(request);
        return runtimeState.snapshot();
    }

    /** Phase 202 — enable PUT assist advisory (no auto short execution). */
    @PutMapping("/runtime/bearish-assist")
    public LiveTraderDtos.RuntimeControlsDto setBearishAssistMode(
            @RequestParam(defaultValue = "LONG_PLUS_PUT_ASSIST") String mode
    ) {
        runtimeState.apply(new LiveTraderDtos.SetRuntimeControlsRequest(
                null, null, null, null,
                com.tradingbot.bearishassist.BearishAssistService.parseMode(mode),
                null));
        return runtimeState.snapshot();
    }

    @GetMapping("/ops")
    public LiveTraderDtos.OperationalMonitorDto ops() {
        return operationalService.monitor();
    }

    /** Phase 189 — portfolio orchestration state (active / queue / suppressed / replacement). */
    @GetMapping("/portfolio-state")
    public LiveTraderDtos.PortfolioStateDto portfolioState() {
        var tier1 = snapshotService.tier1();
        return portfolioOrchestrationService.refresh(tier1, marketHeartbeatService.heartbeat());
    }

    @PostMapping("/kill-switch")
    public LiveTraderDtos.KillSwitchResultDto killSwitch() {
        return safetyService.activateKillSwitch();
    }

    @PostMapping("/kill-switch/reset")
    public LiveTraderDtos.KillSwitchResultDto resetKillSwitch() {
        return safetyService.resetKillSwitch();
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
