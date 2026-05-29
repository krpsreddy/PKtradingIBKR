package com.tradingbot.scheduler;

import com.tradingbot.intelligence.execution.realtime.RealTimeExecutionEngine;
import com.tradingbot.replay.ReplayRuntimeMode;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.TradingPipelineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Phase 167 — 1 second nano scanner loop. */
@Slf4j
@Component
@RequiredArgsConstructor
public class NanoScannerScheduler {

    private final RealTimeExecutionEngine executionEngine;
    private final MarketHoursService marketHoursService;
    private final TradingPipelineService tradingPipelineService;
    private final ReplayRuntimeMode replayRuntimeMode;

    @Scheduled(fixedRate = 1000, initialDelay = 3000)
    public void nanoScan() {
        if (replayRuntimeMode.isReplayActive() || !tradingPipelineService.isLiveSignalsEnabled()) {
            return;
        }
        try {
            executionEngine.nanoScanTick();
        } catch (Exception e) {
            log.debug("Nano scan tick failed: {}", e.getMessage());
        }
    }
}
