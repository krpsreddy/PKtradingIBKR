package com.tradingbot.intelligence;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.*;
import com.tradingbot.models.Candle;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.repository.CandleRepository;
import com.tradingbot.services.MarketHoursService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class IntradayIntelligenceService {

    private final MultiTimeframeAnalysisService multiTimeframeAnalysisService;
    private final ExtendedConditionService extendedConditionService;
    private final SignalFreshnessService signalFreshnessService;
    private final MarketRegimeService marketRegimeService;
    private final SignalRankingEngine signalRankingEngine;
    private final ExecutionIntelligenceService executionIntelligenceService;
    private final CandleRepository candleRepository;
    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;

    public SymbolIntelligenceDto analyzeSymbol(String symbol, IndicatorResult indicators,
                                                TradingSignal latestSignal) {
        String sym = symbol.toUpperCase();
        MultiTimeframeDto mtf = multiTimeframeAnalysisService.analyze(sym);
        List<Candle> session = loadSessionCandles(sym);
        ExtendedStateDto extended = extendedConditionService.evaluate(indicators, session);
        SignalFreshnessDto freshness = latestSignal != null
                ? signalFreshnessService.evaluate(latestSignal.getTimestamp())
                : signalFreshnessService.evaluate(null);

        boolean bullish = latestSignal == null
                || SignalRankingEngine.isBullishSignalType(latestSignal.getSignalType());
        SignalRankDto rank = signalRankingEngine.rank(latestSignal, indicators, mtf, extended, freshness, bullish);

        MarketRegimeDto regime = marketRegimeService.getRegime();
        boolean regimeAligned = bullish
                ? marketRegimeService.supportsBullishBreakouts()
                : marketRegimeService.supportsBearishBreakdowns();

        ExecutionIntelligenceDto execution = executionIntelligenceService.analyze(
                SymbolIntelligenceDto.builder()
                        .symbol(sym)
                        .mtf(mtf)
                        .extended(extended)
                        .freshness(freshness)
                        .rank(rank)
                        .regimeAligned(regimeAligned)
                        .regimeImpact(regime.getRegime())
                        .build(),
                indicators, latestSignal, session);

        return SymbolIntelligenceDto.builder()
                .symbol(sym)
                .mtf(mtf)
                .extended(extended)
                .freshness(freshness)
                .rank(rank)
                .regimeAligned(regimeAligned)
                .regimeImpact(regime.getRegime())
                .execution(execution)
                .build();
    }

    public MarketRegimeDto getMarketRegime() {
        return marketRegimeService.getRegime();
    }

    private List<Candle> loadSessionCandles(String symbol) {
        return candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, tradingProperties.getTimeframe())
                .stream()
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
    }
}
