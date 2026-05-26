package com.tradingbot.intelligence;

import com.tradingbot.models.Candle;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class CandleAggregationService {

    public List<Candle> aggregate(List<Candle> candles, int barsPerGroup) {
        if (candles == null || candles.size() < barsPerGroup || barsPerGroup < 1) {
            return List.of();
        }
        List<Candle> sorted = candles.stream()
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
        List<Candle> out = new ArrayList<>();
        int start = sorted.size() % barsPerGroup;
        for (int idx = start; idx + barsPerGroup <= sorted.size(); idx += barsPerGroup) {
            List<Candle> group = sorted.subList(idx, idx + barsPerGroup);
            Candle first = group.get(0);
            Candle last = group.get(group.size() - 1);
            BigDecimal high = group.stream().map(Candle::getHigh).max(BigDecimal::compareTo).orElse(first.getHigh());
            BigDecimal low = group.stream().map(Candle::getLow).min(BigDecimal::compareTo).orElse(first.getLow());
            long volume = group.stream()
                    .mapToLong(c -> c.getVolume() != null ? c.getVolume() : 0L)
                    .sum();
            LocalDateTime closeTime = last.getCloseTime() != null ? last.getCloseTime() : last.getOpenTime();
            out.add(Candle.builder()
                    .symbol(first.getSymbol())
                    .timeframe(first.getTimeframe())
                    .openTime(first.getOpenTime())
                    .closeTime(closeTime)
                    .open(first.getOpen())
                    .high(high)
                    .low(low)
                    .close(last.getClose())
                    .volume(volume)
                    .build());
        }
        return out;
    }

    public double verticalMovePct(List<Candle> candles, int lookback) {
        if (candles == null || candles.size() < 2) {
            return 0;
        }
        List<Candle> sorted = candles.stream()
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
        int start = Math.max(0, sorted.size() - lookback);
        BigDecimal startClose = sorted.get(start).getClose();
        BigDecimal endClose = sorted.get(sorted.size() - 1).getClose();
        if (startClose.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        return endClose.subtract(startClose).abs()
                .divide(startClose, 4, RoundingMode.HALF_UP)
                .doubleValue();
    }
}
