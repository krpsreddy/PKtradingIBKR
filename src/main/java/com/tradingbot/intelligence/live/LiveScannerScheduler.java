package com.tradingbot.intelligence.live;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Keeps live scanner snapshot fresh during market hours. */
@Slf4j
@Component
@RequiredArgsConstructor
public class LiveScannerScheduler {

    private final LiveScannerService liveScannerService;

    @EventListener(ApplicationReadyEvent.class)
    public void warmOnStartup() {
        liveScannerService.refresh();
    }

    @Scheduled(fixedRate = 2000, initialDelay = 5000)
    public void tick() {
        try {
            liveScannerService.refresh();
        } catch (Exception ex) {
            log.warn("Live scanner tick failed: {}", ex.getMessage());
        }
    }

    @Scheduled(cron = "0 30 9 * * MON-FRI", zone = "America/New_York")
    public void sessionOpenWarmup() {
        log.info("Session open — warming live scanner");
        liveScannerService.refresh();
    }
}
