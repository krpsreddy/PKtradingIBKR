package com.tradingbot.scheduler;

import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.TradingPipelineService;
import com.tradingbot.services.TradingSymbolService;
import com.tradingbot.signals.OpenScoutSignalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class OpenScoutScheduler {

    private final OpenScoutSignalService openScoutSignalService;
    private final MarketHoursService marketHoursService;
    private final TradingSymbolService tradingSymbolService;
    private final TradingPipelineService tradingPipelineService;

    @Scheduled(fixedRate = 3000)
    public void scoutSweep() {
        if (!tradingPipelineService.isLiveSignalsEnabled() || !marketHoursService.isOpenScoutWindow()) {
            return;
        }
        for (String symbol : tradingSymbolService.getScanSymbolSet()) {
            try {
                openScoutSignalService.sweepSymbol(symbol);
            } catch (Exception e) {
                log.debug("Scout sweep failed for {}", symbol, e);
            }
        }
    }
}
