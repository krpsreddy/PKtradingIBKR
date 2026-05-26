package com.tradingbot.historical;

import com.tradingbot.services.TradingSymbolService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class CandleRetentionScheduler {

    private final CandleHistoryService candleHistoryService;
    private final TradingSymbolService tradingSymbolService;

    /** Daily purge of candles beyond retention window. */
    @Scheduled(cron = "0 0 2 * * *", zone = "America/New_York")
    public void purgeExpiredCandles() {
        tradingSymbolService.findEnabledForDisplay().forEach(s ->
                candleHistoryService.purgeExpiredForSymbol(s.getSymbol()));
        log.debug("Candle retention purge completed");
    }
}
