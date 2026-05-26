package com.tradingbot.indicators;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.models.Candle;
import com.tradingbot.models.IndicatorSnapshot;
import com.tradingbot.repository.IndicatorSnapshotRepository;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.ta4j.core.BarSeries;
import org.ta4j.core.BaseBarSeriesBuilder;
import org.ta4j.core.indicators.EMAIndicator;
import org.ta4j.core.indicators.MACDIndicator;
import org.ta4j.core.indicators.RSIIndicator;
import org.ta4j.core.indicators.helpers.ClosePriceIndicator;
import org.ta4j.core.num.Num;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class IndicatorCalculationService {

    private static final int EMA_FAST = 9;
    private static final int EMA_SHORT = 20;
    private static final int EMA_LONG = 50;
    private static final int RSI_PERIOD = 14;
    private static final int MACD_SIGNAL_PERIOD = 9;

    private final IndicatorSnapshotRepository indicatorSnapshotRepository;
    private final TradingProperties tradingProperties;

    public IndicatorResult calculateIndicators(List<Candle> candles) {
        return calculateIndicators(candles, tradingProperties.getMinCandlesForSignals());
    }

    public IndicatorResult calculateIndicators(List<Candle> candles, int minBarsRequired) {
        int minBars = minBarsRequired > 0 ? minBarsRequired : tradingProperties.getMinCandlesForSignals();
        if (candles == null || candles.size() < minBars) {
            log.debug("Need at least {} candles for indicators, have {}",
                    minBars, candles == null ? 0 : candles.size());
            return IndicatorResult.builder().valid(false).build();
        }

        List<Candle> sorted = candles.stream()
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();

        Candle current = sorted.get(sorted.size() - 1);
        Candle previous = sorted.size() > 1 ? sorted.get(sorted.size() - 2) : null;

        BarSeries series = new BaseBarSeriesBuilder().withName(sorted.get(0).getSymbol()).build();
        int barMinutes = tradingProperties.getCandleMinutes();

        for (Candle candle : sorted) {
            ZonedDateTime end = MarketTime.toMarketZoned(candle.getCloseTime());
            series.addBar(
                    Duration.ofMinutes(barMinutes),
                    end,
                    candle.getOpen().doubleValue(),
                    candle.getHigh().doubleValue(),
                    candle.getLow().doubleValue(),
                    candle.getClose().doubleValue(),
                    candle.getVolume() != null ? candle.getVolume().doubleValue() : 0.0
            );
        }

        int lastIndex = series.getEndIndex();
        int prevIndex = lastIndex > series.getBeginIndex() ? lastIndex - 1 : lastIndex;
        ClosePriceIndicator close = new ClosePriceIndicator(series);
        EMAIndicator ema9 = new EMAIndicator(close, EMA_FAST);
        EMAIndicator ema20 = new EMAIndicator(close, EMA_SHORT);
        EMAIndicator ema50 = new EMAIndicator(close, EMA_LONG);
        RSIIndicator rsi = new RSIIndicator(close, RSI_PERIOD);
        MACDIndicator macd = new MACDIndicator(close);
        EMAIndicator signalLine = new EMAIndicator(macd, MACD_SIGNAL_PERIOD);

        BigDecimal ema9Val = toBigDecimal(ema9.getValue(lastIndex));
        BigDecimal ema20Val = toBigDecimal(ema20.getValue(lastIndex));
        BigDecimal ema50Val = toBigDecimal(ema50.getValue(lastIndex));
        BigDecimal rsiVal = toBigDecimal(rsi.getValue(lastIndex));
        BigDecimal macdVal = toBigDecimal(macd.getValue(lastIndex));
        BigDecimal signalVal = toBigDecimal(signalLine.getValue(lastIndex));
        BigDecimal prevEma9 = toBigDecimal(ema9.getValue(prevIndex));
        BigDecimal prevEma20 = toBigDecimal(ema20.getValue(prevIndex));
        BigDecimal prevMacd = toBigDecimal(macd.getValue(prevIndex));
        BigDecimal prevSignal = toBigDecimal(signalLine.getValue(prevIndex));
        BigDecimal closeVal = toBigDecimal(close.getValue(lastIndex));
        BigDecimal vwapVal = calculateVwap(sorted, current);
        Long avgVolume = calculateAverageVolume(sorted, tradingProperties.getAvgVolumePeriod());
        Long currentVolume = current.getVolume() != null ? current.getVolume() : 0L;
        BigDecimal relativeVolume = calculateRelativeVolume(currentVolume, avgVolume);

        log.info("Indicator snapshot: EMA9={} EMA20={} EMA50={} RSI={} MACD={} Signal={} VWAP={} AvgVol={} RelVol={}x",
                ema9Val, ema20Val, ema50Val, rsiVal, macdVal, signalVal, vwapVal, avgVolume, relativeVolume);

        return IndicatorResult.builder()
                .ema9(ema9Val)
                .ema20(ema20Val)
                .ema50(ema50Val)
                .rsi(rsiVal)
                .macd(macdVal)
                .signalLine(signalVal)
                .previousEma9(prevEma9)
                .previousEma20(prevEma20)
                .previousMacd(prevMacd)
                .previousSignalLine(prevSignal)
                .vwap(vwapVal)
                .avgVolume(avgVolume)
                .volume(currentVolume)
                .relativeVolume(relativeVolume)
                .open(current.getOpen())
                .high(current.getHigh())
                .low(current.getLow())
                .close(closeVal)
                .previousClose(previous != null ? previous.getClose() : null)
                .currentCandle(current)
                .previousCandle(previous)
                .recentCandles(sorted)
                .valid(true)
                .build();
    }

    public BigDecimal calculateRelativeVolume(long currentVolume, long avgVolume) {
        if (avgVolume <= 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf((double) currentVolume / avgVolume)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateVwap(List<Candle> sorted, Candle current) {
        LocalDate sessionDay = MarketTime.toMarketZoned(current.getOpenTime()).toLocalDate();

        double cumPv = 0;
        double cumVol = 0;
        for (Candle c : sorted) {
            LocalDate barDay = MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate();
            if (!barDay.equals(sessionDay)) {
                continue;
            }
            double vol = c.getVolume() != null ? c.getVolume().doubleValue() : 0;
            if (vol <= 0) {
                continue;
            }
            double typical = (c.getHigh().doubleValue() + c.getLow().doubleValue() + c.getClose().doubleValue()) / 3.0;
            cumPv += typical * vol;
            cumVol += vol;
        }
        if (cumVol <= 0) {
            return current.getClose();
        }
        return BigDecimal.valueOf(cumPv / cumVol).setScale(4, RoundingMode.HALF_UP);
    }

    private Long calculateAverageVolume(List<Candle> candles, int period) {
        int size = Math.min(period, candles.size());
        long total = 0;
        for (int i = candles.size() - size; i < candles.size(); i++) {
            total += candles.get(i).getVolume() != null ? candles.get(i).getVolume() : 0;
        }
        return size > 0 ? total / size : 0L;
    }

    public IndicatorSnapshot persistSnapshot(String symbol, IndicatorResult result) {
        IndicatorSnapshot snapshot = IndicatorSnapshot.builder()
                .symbol(symbol)
                .ema9(result.getEma9())
                .ema20(result.getEma20())
                .ema50(result.getEma50())
                .rsi(result.getRsi())
                .macd(result.getMacd())
                .signalLine(result.getSignalLine())
                .vwap(result.getVwap())
                .avgVolume(result.getAvgVolume())
                .relativeVolume(result.getRelativeVolume())
                .timestamp(MarketTime.nowLocal())
                .build();
        return indicatorSnapshotRepository.save(snapshot);
    }

    private BigDecimal toBigDecimal(Num num) {
        if (num == null) {
            return null;
        }
        return BigDecimal.valueOf(num.doubleValue()).setScale(4, RoundingMode.HALF_UP);
    }
}
