package com.tradingbot.intelligence;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorCalculationService;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.MultiTimeframeDto;
import com.tradingbot.models.Candle;
import com.tradingbot.repository.CandleRepository;
import com.tradingbot.services.MarketHoursService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@RequiredArgsConstructor
public class MultiTimeframeAnalysisService {

    private static final int MIN_15M_BARS = 20;
    private static final int MIN_1H_BARS = 20;

    private final CandleRepository candleRepository;
    private final CandleAggregationService candleAggregationService;
    private final IndicatorCalculationService indicatorCalculationService;
    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;

    private final ConcurrentMap<String, CachedMtf> cache = new ConcurrentHashMap<>();

    public MultiTimeframeDto analyze(String symbol) {
        String sym = symbol.toUpperCase();
        CachedMtf cached = cache.get(sym);
        if (cached != null && !cached.isExpired()) {
            return cached.dto();
        }
        MultiTimeframeDto dto = compute(sym);
        cache.put(sym, new CachedMtf(dto, System.currentTimeMillis()));
        return dto;
    }

    public void invalidate(String symbol) {
        if (symbol != null) {
            cache.remove(symbol.toUpperCase());
        }
    }

    private MultiTimeframeDto compute(String symbol) {
        List<Candle> candles5m = loadSessionCandles(symbol);
        if (candles5m.size() < tradingProperties.getMinCandlesForSignals()) {
            return empty();
        }
        IndicatorResult i5 = indicatorCalculationService.calculateIndicators(candles5m);
        if (!i5.isValid()) {
            return empty();
        }

        String trend5m = classify5m(i5);
        String trend15m = "neutral";
        String trend1h = "neutral";

        List<Candle> candles15m = candleAggregationService.aggregate(candles5m, 3);
        if (candles15m.size() >= MIN_15M_BARS) {
            IndicatorResult i15 = indicatorCalculationService.calculateIndicators(candles15m, MIN_15M_BARS);
            if (i15.isValid()) {
                trend15m = classify15m(i15);
            }
        }

        List<Candle> candles1h = candleAggregationService.aggregate(candles5m, 12);
        if (candles1h.size() >= MIN_1H_BARS) {
            IndicatorResult i1h = indicatorCalculationService.calculateIndicators(candles1h, MIN_1H_BARS);
            if (i1h.isValid()) {
                trend1h = classify1h(i1h);
            }
        }

        int score = alignmentScore(trend5m, trend15m, trend1h);
        boolean bull = score >= 3 && !"bearish".equals(trend15m) && !"bearish".equals(trend1h);
        boolean bear = score <= -2 || ("bearish".equals(trend15m) && "bearish".equals(trend1h));

        return MultiTimeframeDto.builder()
                .trend5m(trend5m)
                .trend15m(trend15m)
                .trend1h(trend1h)
                .alignmentScore(score)
                .alignedBullish(bull)
                .alignedBearish(bear)
                .summary(formatSummary(trend5m, trend15m, trend1h))
                .build();
    }

    private List<Candle> loadSessionCandles(String symbol) {
        return candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, tradingProperties.getTimeframe())
                .stream()
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
    }

    private String classify5m(IndicatorResult i) {
        boolean bull = i.getEma9().compareTo(i.getEma20()) > 0
                && i.getClose().compareTo(i.getVwap()) > 0
                && i.getRsi().compareTo(BigDecimal.valueOf(50)) > 0
                && i.getMacd().compareTo(i.getSignalLine()) > 0;
        if (bull) {
            return "bullish";
        }
        boolean bear = i.getEma9().compareTo(i.getEma20()) < 0
                && i.getClose().compareTo(i.getVwap()) < 0;
        if (bear) {
            return "bearish";
        }
        return "neutral";
    }

    private String classify15m(IndicatorResult i) {
        boolean bull = i.getEma9().compareTo(i.getEma20()) > 0
                && i.getClose().compareTo(i.getVwap()) > 0
                && i.getRsi().compareTo(BigDecimal.valueOf(50)) > 0;
        if (bull) {
            return "bullish";
        }
        boolean bear = i.getEma9().compareTo(i.getEma20()) < 0
                && i.getClose().compareTo(i.getVwap()) < 0;
        if (bear) {
            return "bearish";
        }
        return "neutral";
    }

    private String classify1h(IndicatorResult i) {
        boolean bull = i.getEma20().compareTo(i.getEma50()) > 0
                && i.getClose().compareTo(i.getEma20()) > 0;
        if (bull) {
            return "bullish";
        }
        boolean bear = i.getEma20().compareTo(i.getEma50()) < 0;
        if (bear) {
            return "bearish";
        }
        return "neutral";
    }

    private int alignmentScore(String t5, String t15, String t1h) {
        int score = 0;
        if ("bullish".equals(t15)) score += 2;
        if ("bearish".equals(t15)) score -= 2;
        if ("bullish".equals(t1h)) score += 2;
        if ("bearish".equals(t1h)) score -= 2;
        if ("bullish".equals(t5)) score += 1;
        if ("bearish".equals(t5)) score -= 1;
        return score;
    }

    private String formatSummary(String t5, String t15, String t1h) {
        return "5m " + capitalize(t5) + " · 15m " + capitalize(t15) + " · 1h " + capitalize(t1h);
    }

    private String capitalize(String t) {
        if (t == null || t.isBlank()) {
            return "Neutral";
        }
        return t.substring(0, 1).toUpperCase() + t.substring(1);
    }

    private MultiTimeframeDto empty() {
        return MultiTimeframeDto.builder()
                .trend5m("neutral")
                .trend15m("neutral")
                .trend1h("neutral")
                .alignmentScore(0)
                .alignedBullish(false)
                .alignedBearish(false)
                .summary("5m Neutral · 15m Neutral · 1h Neutral")
                .build();
    }

    private record CachedMtf(MultiTimeframeDto dto, long fetchedAt) {
        boolean isExpired() {
            return System.currentTimeMillis() - fetchedAt > 60_000L;
        }
    }
}
