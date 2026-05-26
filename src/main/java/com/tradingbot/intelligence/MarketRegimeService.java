package com.tradingbot.intelligence;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorCalculationService;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.MarketRegimeDto;
import com.tradingbot.models.Candle;
import com.tradingbot.repository.CandleRepository;
import com.tradingbot.services.MarketHoursService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

@Service
@RequiredArgsConstructor
public class MarketRegimeService {

    private final CandleRepository candleRepository;
    private final TradingProperties tradingProperties;
    private final IndicatorCalculationService indicatorCalculationService;
    private final MarketHoursService marketHoursService;

    private final AtomicReference<CachedRegime> cache = new AtomicReference<>();

    public MarketRegimeDto getRegime() {
        CachedRegime cached = cache.get();
        if (cached != null && !cached.isExpired()) {
            return cached.dto();
        }
        MarketRegimeDto dto = compute();
        cache.set(new CachedRegime(dto, System.currentTimeMillis()));
        return dto;
    }

    public boolean isChoppy() {
        return getRegime().isChoppy();
    }

    public boolean supportsBullishBreakouts() {
        String regime = getRegime().getRegime();
        return "TRENDING_BULL".equals(regime) || "RISK_ON".equals(regime);
    }

    public boolean supportsBearishBreakdowns() {
        String regime = getRegime().getRegime();
        return "TRENDING_BEAR".equals(regime) || "RISK_OFF".equals(regime);
    }

    private MarketRegimeDto compute() {
        IndexSnapshot spy = indexSnapshot("SPY");
        IndexSnapshot qqq = indexSnapshot("QQQ");

        String spyTrend = spy.trend();
        String qqqTrend = qqq.trend();
        boolean riskOn = spy.aboveVwap && qqq.aboveVwap && spy.rvol >= 1.0;
        boolean riskOff = !spy.aboveVwap && !qqq.aboveVwap;
        boolean choppy = spy.chop || qqq.chop;
        boolean lowMom = spy.rvol < 0.9 && qqq.rvol < 0.9;

        String regime;
        if (choppy) {
            regime = "CHOPPY";
        } else if ("bullish".equals(spyTrend) && "bullish".equals(qqqTrend) && riskOn) {
            regime = "TRENDING_BULL";
        } else if ("bearish".equals(spyTrend) && "bearish".equals(qqqTrend)) {
            regime = "TRENDING_BEAR";
        } else if (riskOn) {
            regime = "RISK_ON";
        } else if (riskOff) {
            regime = "RISK_OFF";
        } else if (lowMom) {
            regime = "LOW_MOMENTUM";
        } else {
            regime = "CHOPPY";
        }

        return MarketRegimeDto.builder()
                .regime(regime)
                .spyTrend(spyTrend)
                .qqqTrend(qqqTrend)
                .riskOn(riskOn)
                .choppy(choppy)
                .summary(regime.replace('_', ' '))
                .build();
    }

    private IndexSnapshot indexSnapshot(String symbol) {
        List<Candle> candles = candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, tradingProperties.getTimeframe())
                .stream()
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
        if (candles.size() < 20) {
            return IndexSnapshot.neutral();
        }
        IndicatorResult ind = indicatorCalculationService.calculateIndicators(candles, 20);
        if (!ind.isValid()) {
            return IndexSnapshot.neutral();
        }
        String trend = "neutral";
        if (ind.getEma9().compareTo(ind.getEma20()) > 0 && ind.getEma20().compareTo(ind.getEma50()) > 0) {
            trend = "bullish";
        } else if (ind.getEma9().compareTo(ind.getEma20()) < 0 && ind.getEma20().compareTo(ind.getEma50()) < 0) {
            trend = "bearish";
        }
        boolean aboveVwap = ind.getClose().compareTo(ind.getVwap()) > 0;
        double rvol = ind.getRelativeVolume() != null ? ind.getRelativeVolume().doubleValue() : 0;
        boolean chop = isChopRange(candles, ind.getClose());
        return new IndexSnapshot(trend, aboveVwap, rvol, chop);
    }

    private boolean isChopRange(List<Candle> candles, BigDecimal close) {
        if (candles.size() < 6 || close.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        int end = candles.size() - 1;
        int start = Math.max(0, end - 5);
        BigDecimal maxHigh = null;
        BigDecimal minLow = null;
        for (int idx = start; idx <= end; idx++) {
            Candle c = candles.get(idx);
            maxHigh = maxHigh == null ? c.getHigh() : maxHigh.max(c.getHigh());
            minLow = minLow == null ? c.getLow() : minLow.min(c.getLow());
        }
        if (maxHigh == null || minLow == null) {
            return false;
        }
        BigDecimal rangePct = maxHigh.subtract(minLow).divide(close, 4, RoundingMode.HALF_UP);
        return rangePct.compareTo(BigDecimal.valueOf(tradingProperties.getRegimeChopRangePct())) < 0;
    }

    private record IndexSnapshot(String trend, boolean aboveVwap, double rvol, boolean chop) {
        static IndexSnapshot neutral() {
            return new IndexSnapshot("neutral", false, 0, false);
        }
    }

    private record CachedRegime(MarketRegimeDto dto, long fetchedAt) {
        boolean isExpired() {
            return System.currentTimeMillis() - fetchedAt > 30_000L;
        }
    }
}
