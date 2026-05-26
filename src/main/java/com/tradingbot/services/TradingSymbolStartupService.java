package com.tradingbot.services;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class TradingSymbolStartupService implements ApplicationRunner {

    private final TradingSymbolService tradingSymbolService;

    @Override
    public void run(ApplicationArguments args) {
        int count = tradingSymbolService.findEnabledForDisplay().size();
        tradingSymbolService.activateAllOnStartup();
        log.info("Loaded {} enabled trading symbols from database", count);
    }
}
