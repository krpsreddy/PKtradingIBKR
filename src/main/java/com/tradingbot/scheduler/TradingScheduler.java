package com.tradingbot.scheduler;

import com.tradingbot.services.TradingPipelineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class TradingScheduler {

    private final TradingPipelineService tradingPipelineService;

    /** Runs every 5 minutes — finalize 5m candle, recalc indicators, evaluate signals. */
    @Scheduled(fixedRate = 300000, initialDelay = 300000)
    public void processFiveMinuteCycle() {
        log.debug("Running 5-minute trading pipeline");
        try {
            tradingPipelineService.runPipeline();
        } catch (Exception e) {
            log.error("5-minute pipeline failed", e);
        }
    }
}
