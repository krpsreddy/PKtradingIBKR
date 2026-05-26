package com.tradingbot.candle;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.models.Candle;
import com.tradingbot.repository.CandleRepository;
import com.tradingbot.services.MarketTime;
import com.tradingbot.signals.OpenScoutSignalService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Slf4j
@Service
public class CandleAggregatorService {

    private final CandleRepository candleRepository;
    private final TradingProperties tradingProperties;
    private final OpenScoutSignalService openScoutSignalService;
    private final ConcurrentMap<String, MutableCandle> activeCandles = new ConcurrentHashMap<>();

    public CandleAggregatorService(CandleRepository candleRepository,
                                   TradingProperties tradingProperties,
                                   @Lazy OpenScoutSignalService openScoutSignalService) {
        this.candleRepository = candleRepository;
        this.tradingProperties = tradingProperties;
        this.openScoutSignalService = openScoutSignalService;
    }

    public void onTick(String symbol, double price, long volume) {
        LocalDateTime windowStart = windowStart(MarketTime.nowLocal());
        String key = candleKey(symbol);

        activeCandles.compute(key, (k, current) -> {
            if (current != null && !current.openTime.equals(windowStart)) {
                persistIfNew(current);
            }
            if (current == null || !current.openTime.equals(windowStart)) {
                return MutableCandle.open(symbol, tradingProperties, windowStart, price, volume);
            }
            current.update(price, volume);
            return current;
        });

        openScoutSignalService.onTick(symbol, price);
    }

    public Optional<LiveCandleSnapshot> getLiveSnapshot(String symbol) {
        if (symbol == null) {
            return Optional.empty();
        }
        MutableCandle mutable = activeCandles.get(candleKey(symbol));
        if (mutable == null || !mutable.hasData()) {
            return Optional.empty();
        }
        return Optional.of(new LiveCandleSnapshot(
                mutable.symbol,
                mutable.openTime,
                mutable.open,
                mutable.high,
                mutable.low,
                mutable.close,
                mutable.volume));
    }

    public Optional<Candle> finalizeCurrentCandle(String symbol) {
        String key = candleKey(symbol);
        MutableCandle mutable = activeCandles.get(key);
        if (mutable == null || !mutable.hasData()) {
            return Optional.empty();
        }

        LocalDateTime currentWindow = windowStart(MarketTime.nowLocal());
        if (!mutable.openTime.isBefore(currentWindow)) {
            return Optional.empty();
        }

        activeCandles.remove(key);
        return persistIfNew(mutable);
    }

    private Optional<Candle> persistIfNew(MutableCandle mutable) {
        Candle entity = mutable.toEntity();
        boolean exists = candleRepository.findBySymbolAndTimeframeOrderByOpenTimeAsc(
                        entity.getSymbol(), entity.getTimeframe())
                .stream()
                .anyMatch(c -> c.getOpenTime().equals(entity.getOpenTime()));
        if (exists) {
            log.debug("Candle already exists for {} at {}", entity.getSymbol(), entity.getOpenTime());
            return Optional.empty();
        }

        Candle saved = candleRepository.save(entity);
        log.info("{} {} candle: O={} H={} L={} C={} V={}",
                saved.getSymbol(), formatTimeframeLabel(saved.getTimeframe()),
                saved.getOpen(), saved.getHigh(), saved.getLow(), saved.getClose(), saved.getVolume());
        return Optional.of(saved);
    }

    private String formatTimeframeLabel(String timeframe) {
        if ("5MIN".equals(timeframe)) {
            return "5m";
        }
        return timeframe;
    }

    LocalDateTime windowStart(LocalDateTime time) {
        int minutes = tradingProperties.getCandleMinutes();
        int windowMinute = (time.getMinute() / minutes) * minutes;
        return time.truncatedTo(ChronoUnit.HOURS).withMinute(windowMinute).withSecond(0).withNano(0);
    }

    private String candleKey(String symbol) {
        return symbol + ":" + tradingProperties.getTimeframe();
    }

    private static final class MutableCandle {
        String symbol;
        String timeframe;
        int candleMinutes;
        LocalDateTime openTime;
        LocalDateTime closeTime;
        BigDecimal open;
        BigDecimal high;
        BigDecimal low;
        BigDecimal close;
        long volume;

        static MutableCandle open(String symbol, TradingProperties props, LocalDateTime openTime,
                                  double price, long volume) {
            MutableCandle c = new MutableCandle();
            c.symbol = symbol;
            c.timeframe = props.getTimeframe();
            c.candleMinutes = props.getCandleMinutes();
            c.openTime = openTime;
            c.closeTime = openTime.plusMinutes(c.candleMinutes);
            BigDecimal p = BigDecimal.valueOf(price);
            c.open = p;
            c.high = p;
            c.low = p;
            c.close = p;
            c.volume = volume;
            return c;
        }

        void update(double price, long tickVolume) {
            BigDecimal p = BigDecimal.valueOf(price);
            if (p.compareTo(high) > 0) {
                high = p;
            }
            if (p.compareTo(low) < 0) {
                low = p;
            }
            close = p;
            if (tickVolume > 0) {
                volume += tickVolume;
            }
        }

        boolean hasData() {
            return open != null;
        }

        Candle toEntity() {
            return Candle.builder()
                    .symbol(symbol)
                    .timeframe(timeframe)
                    .open(open)
                    .high(high)
                    .low(low)
                    .close(close)
                    .volume(volume)
                    .openTime(openTime)
                    .closeTime(closeTime)
                    .build();
        }
    }
}
