package com.tradingbot.services;

import com.tradingbot.candle.CandleAggregatorService;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorCalculationService;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.Candle;
import com.tradingbot.repository.CandleRepository;
import com.tradingbot.signals.ImbalanceSignalService;
import com.tradingbot.signals.OpenFailSignalService;
import com.tradingbot.signals.OpenMomentumSignalService;
import com.tradingbot.signals.PremarketTrackerService;
import com.tradingbot.signals.RecoveryFailSignalService;
import com.tradingbot.signals.SignalEngineService;
import com.tradingbot.services.TradingSymbolService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
@RequiredArgsConstructor
public class TradingPipelineService {

    private final TradingProperties tradingProperties;
    private final CandleAggregatorService candleAggregatorService;
    private final CandleRepository candleRepository;
    private final IndicatorCalculationService indicatorCalculationService;
    private final SignalEngineService signalEngineService;
    private final OpenMomentumSignalService openMomentumSignalService;
    private final OpenFailSignalService openFailSignalService;
    private final RecoveryFailSignalService recoveryFailSignalService;
    private final ImbalanceSignalService imbalanceSignalService;
    private final PremarketTrackerService premarketTrackerService;
    private final TradingSymbolService tradingSymbolService;

    private final AtomicBoolean liveSignalsEnabled = new AtomicBoolean(false);

    public void enableLiveSignals() {
        liveSignalsEnabled.set(true);
        log.info("Live signal engine enabled — historical preload complete");
    }

    public boolean isLiveSignalsEnabled() {
        return liveSignalsEnabled.get();
    }

    public void runPipeline() {
        if (!liveSignalsEnabled.get()) {
            log.debug("Waiting for historical preload before live signals");
            return;
        }

        for (String symbol : tradingSymbolService.getScanSymbolSet()) {
            try {
                runPipelineForSymbol(symbol);
            } catch (Exception e) {
                log.error("Pipeline failed for {}", symbol, e);
            }
        }
    }

    private void runPipelineForSymbol(String symbol) {
        candleAggregatorService.finalizeCurrentCandle(symbol);

        List<Candle> candles = candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, tradingProperties.getTimeframe())
                .stream()
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();

        int minCandles = tradingProperties.getMinCandlesForSignals();
        if (candles.size() < minCandles) {
            log.debug("{} — waiting for more candles: have {}, need {}", symbol, candles.size(), minCandles);
            return;
        }

        IndicatorResult result = indicatorCalculationService.calculateIndicators(candles);
        if (!result.isValid()) {
            return;
        }

        indicatorCalculationService.persistSnapshot(symbol, result);
        premarketTrackerService.updateFromCandles(symbol, candles);
        openMomentumSignalService.evaluateOpenMomentum(symbol, result);
        openFailSignalService.evaluateOpenFail(symbol, result);
        recoveryFailSignalService.evaluateRecoveryFail(symbol, result);
        imbalanceSignalService.evaluateImbalance(symbol, result);
        signalEngineService.evaluateSignals(symbol, result);
    }
}
