package com.tradingbot.dataintegrity.health;

import com.tradingbot.dataintegrity.DataIntegrityEngine;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.replay.ReplayRuntimeMode;
import com.tradingbot.services.TradingSymbolService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Phase 212 — periodic tick freshness + continuity sweep. */
@Slf4j
@Component
@RequiredArgsConstructor
public class MarketDataHealthMonitor {

    private final DataIntegrityEngine integrityEngine;
    private final ReplayRuntimeMode replayRuntimeMode;
    private final TradingSymbolService tradingSymbolService;
    private final IBKRClientService ibkrClientService;

    @Scheduled(fixedDelayString = "${live.integrity.health-poll-ms:5000}")
    public void poll() {
        if (replayRuntimeMode.isReplayActive()) {
            return;
        }
        if (!ibkrClientService.isConnected()) {
            integrityEngine.onDisconnected();
            return;
        }
        Set<String> symbols = tradingSymbolService.getEnabledSymbolSet();
        List<String> sample = new ArrayList<>(symbols);
        if (sample.size() > 12) {
            sample = sample.stream().limit(12).toList();
        }
        for (String sym : sample) {
            Long tickMs = ibkrClientService.getLastTickEpochMs(sym);
            if (tickMs != null && tickMs > 0) {
                double price = ibkrClientService.getLastPrice(sym);
                integrityEngine.recordTick(sym, price, tickMs);
            }
        }
        integrityEngine.assessGlobal();
    }
}
