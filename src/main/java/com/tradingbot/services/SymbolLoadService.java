package com.tradingbot.services;

import com.tradingbot.api.dto.SymbolSubscribeDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.ibkr.HistoricalDataService;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.ibkr.SubscriptionManagerService;
import com.tradingbot.ibkr.stream.DynamicLiveStreamOrchestrator;
import com.tradingbot.repository.CandleRepository;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class SymbolLoadService {

    private final CandleRepository candleRepository;
    private final TradingProperties tradingProperties;
    private final SymbolContextRegistry symbolContextRegistry;
    private final SubscriptionManagerService subscriptionManager;
    private final IBKRClientService ibkrClientService;
    private final HistoricalDataService historicalDataService;
    private final ObjectProvider<DynamicLiveStreamOrchestrator> streamOrchestratorProvider;

    public SymbolSubscribeDto activateSymbol(String symbol) {
        String sym = symbol.toUpperCase();
        SymbolContext ctx = symbolContextRegistry.getOrCreate(sym);

        if (ibkrClientService.isConnected()) {
            DynamicLiveStreamOrchestrator orchestrator = streamOrchestratorProvider.getIfAvailable();
            if (orchestrator != null && orchestrator.isDynamicEnabled()) {
                orchestrator.onSymbolTouched(sym);
            } else {
                subscriptionManager.subscribeIfNeeded(sym);
            }
        }

        long count = candleRepository.countBySymbolAndTimeframe(sym, tradingProperties.getTimeframe());
        int minRequired = Math.min(10, tradingProperties.getMinCandlesForSignals());

        if (ctx.isLoadingHistorical() && count >= minRequired) {
            symbolContextRegistry.markHistoricalLoaded(sym);
        }

        if (count >= minRequired || ctx.isHistoricalLoaded()) {
            ctx.setHistoricalLoaded(true);
            ctx.setLoadingHistorical(false);
            boolean wasCached = ctx.hasValidCache();
            symbolContextRegistry.markCached(sym);
            return SymbolSubscribeDto.builder()
                    .symbol(sym)
                    .status("READY")
                    .historicalLoaded(true)
                    .liveSubscribed(subscriptionManager.isSubscribed(sym))
                    .cached(wasCached)
                    .candleCount((int) count)
                    .message("Using cached candles for " + sym)
                    .build();
        }

        if (!ctx.isLoadingHistorical()) {
            symbolContextRegistry.markLoading(sym);
            requestHistoricalAsync(sym);
        }

        if (!ibkrClientService.isConnected()) {
            ctx.setLoadingHistorical(false);
            return SymbolSubscribeDto.builder()
                    .symbol(sym)
                    .status("ERROR")
                    .historicalLoaded(false)
                    .liveSubscribed(subscriptionManager.isSubscribed(sym))
                    .cached(false)
                    .candleCount((int) count)
                    .message("IBKR not connected — start TWS/Gateway (port 7496 paper / 7497 live) then retry")
                    .build();
        }

        return SymbolSubscribeDto.builder()
                .symbol(sym)
                .status("LOADING")
                .historicalLoaded(false)
                .liveSubscribed(subscriptionManager.isSubscribed(sym))
                .cached(false)
                .candleCount((int) count)
                .message("Loading historical data for " + sym)
                .build();
    }

    public boolean hasHistoricalData(String symbol) {
        long count = candleRepository.countBySymbolAndTimeframe(
                symbol.toUpperCase(), tradingProperties.getTimeframe());
        return count >= 10;
    }

    private void requestHistoricalAsync(String symbol) {
        if (!ibkrClientService.isConnected()) {
            log.debug("IBKR not connected — cannot load historical for {}", symbol);
            SymbolContext ctx = symbolContextRegistry.getOrCreate(symbol);
            ctx.setLoadingHistorical(false);
            return;
        }
        var jobOpt = historicalDataService.startOnDemand(symbol, saved -> {
            if (saved > 0) {
                symbolContextRegistry.markHistoricalLoaded(symbol);
            } else {
                SymbolContext ctx = symbolContextRegistry.getOrCreate(symbol);
                ctx.setLoadingHistorical(false);
            }
        });
        jobOpt.ifPresent(job -> ibkrClientService.fireHistoricalRequest(job));
    }
}
