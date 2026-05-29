package com.tradingbot.sessionintelligence;

import com.tradingbot.services.TradingSymbolService;
import com.tradingbot.sessionintelligence.session.PremarketSessionWindow;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Phase 211 — refresh PM intelligence 9:00–9:30 ET. */
@Slf4j
@Component
@RequiredArgsConstructor
public class PremarketIntelligenceScheduler {

    private final PremarketIntelligenceService premarketService;
    private final PremarketSessionWindow sessionWindow;
    private final TradingSymbolService tradingSymbolService;

    @Scheduled(fixedRate = 30_000, initialDelay = 15_000)
    public void refreshActiveWindow() {
        if (!sessionWindow.isActivePremarketIntelligenceWindow()) {
            return;
        }
        for (String sym : tradingSymbolService.getEnabledSymbolSet()) {
            try {
                premarketService.refreshSymbol(sym);
            } catch (Exception e) {
                log.debug("PM refresh {} failed: {}", sym, e.getMessage());
            }
        }
    }
}
