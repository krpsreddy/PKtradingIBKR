package com.tradingbot.intelligence;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorCalculationService;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.Candle;
import com.tradingbot.repository.CandleRepository;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.TradingSymbolService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MarketInternalsService {

    private static final List<String> SEMI_SYMBOLS = List.of("NVDA", "AMD", "AVGO", "SMH");
    private static final List<String> AI_SYMBOLS = List.of("NVDA", "MSFT", "GOOGL", "META", "PLTR");

    private final CandleRepository candleRepository;
    private final TradingProperties tradingProperties;
    private final IndicatorCalculationService indicatorCalculationService;
    private final MarketHoursService marketHoursService;
    private final TradingSymbolService tradingSymbolService;

    public String semiBreadth() {
        return breadthLabel(SEMI_SYMBOLS);
    }

    public String aiBreadth() {
        return breadthLabel(AI_SYMBOLS);
    }

    public double spyPersistence() {
        return trendPersistence("SPY");
    }

    public double qqqPersistence() {
        return trendPersistence("QQQ");
    }

    public double riskOnScore(boolean spyRiskOn, boolean qqqRiskOn, String semi, String ai) {
        double score = 50;
        if (spyRiskOn && qqqRiskOn) score += 25;
        if ("STRONG".equals(semi)) score += 12;
        else if ("WEAK".equals(semi)) score -= 10;
        if ("STRONG".equals(ai)) score += 10;
        else if ("WEAK".equals(ai)) score -= 8;
        return Math.max(0, Math.min(100, score));
    }

    private String breadthLabel(List<String> symbols) {
        int bullish = 0;
        int total = 0;
        for (String sym : symbols) {
            if (tradingSymbolService.findEnabled(sym).isEmpty()) continue;
            IndicatorResult ind = load(sym);
            if (ind == null || !ind.isValid()) continue;
            total++;
            if (ind.getEma9().compareTo(ind.getVwap()) > 0 && ind.getEma9().compareTo(ind.getEma20()) > 0) {
                bullish++;
            }
        }
        if (total == 0) return "—";
        double pct = (double) bullish / total;
        if (pct >= 0.75) return "STRONG";
        if (pct >= 0.5) return "MIXED";
        return "WEAK";
    }

    private double trendPersistence(String symbol) {
        IndicatorResult ind = load(symbol);
        if (ind == null || !ind.isValid()) return 0;
        double score = 50;
        if (ind.getEma9().compareTo(ind.getEma20()) > 0) score += 20;
        if (ind.getEma20().compareTo(ind.getEma50()) > 0) score += 15;
        if (ind.getRecentCandles() != null && ind.getRecentCandles().size() >= 5) {
            int up = 0;
            var candles = ind.getRecentCandles();
            for (int i = candles.size() - 5; i < candles.size(); i++) {
                if (candles.get(i).getClose().compareTo(candles.get(i).getOpen()) > 0) up++;
            }
            score += up * 3;
        }
        return Math.min(100, score);
    }

    private IndicatorResult load(String symbol) {
        List<Candle> candles = candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, tradingProperties.getTimeframe())
                .stream()
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
        if (candles.size() < 20) return null;
        return indicatorCalculationService.calculateIndicators(candles);
    }
}
