package com.tradingbot.services;

import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorCalculationService;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.Candle;
import com.tradingbot.repository.CandleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MarketTrendService {

    private final CandleRepository candleRepository;
    private final TradingProperties tradingProperties;
    private final IndicatorCalculationService indicatorCalculationService;
    private final MarketHoursService marketHoursService;

    public MarketTrendDto getMarketTrend() {
        String spy = resolveTrendFor("SPY");
        String qqq = resolveTrendFor("QQQ");
        boolean aligned = "bullish".equals(spy) && "bullish".equals(qqq);
        return MarketTrendDto.builder()
                .spyTrend(spy)
                .qqqTrend(qqq)
                .marketAligned(aligned)
                .build();
    }

    public boolean isMarketTrendBullish() {
        MarketTrendDto trend = getMarketTrend();
        return "bullish".equals(trend.getSpyTrend()) || "bullish".equals(trend.getQqqTrend());
    }

    private String resolveTrendFor(String symbol) {
        List<Candle> candles = candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, tradingProperties.getTimeframe())
                .stream()
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .toList();
        if (candles.size() < 20) {
            return "neutral";
        }
        IndicatorResult result = indicatorCalculationService.calculateIndicators(candles);
        if (!result.isValid()) {
            return "neutral";
        }
        if (result.getEma9().compareTo(result.getEma20()) > 0
                && result.getEma20().compareTo(result.getEma50()) > 0) {
            return "bullish";
        }
        if (result.getEma9().compareTo(result.getEma20()) < 0
                && result.getEma20().compareTo(result.getEma50()) < 0) {
            return "bearish";
        }
        return "neutral";
    }
}
