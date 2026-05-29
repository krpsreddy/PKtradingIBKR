package com.tradingbot.candle;

import com.tradingbot.models.Candle;
import com.tradingbot.repository.CandleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Idempotent candle inserts — avoids duplicate-key errors when historical preload
 * and live tick aggregation persist the same 5m bar.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CandleWriteService {

    private final CandleRepository candleRepository;
    private final ConcurrentHashMap<String, Object> persistLocks = new ConcurrentHashMap<>();

    @Transactional
    public Optional<Candle> saveIfAbsent(Candle candle) {
        if (candle == null || candle.getSymbol() == null || candle.getOpenTime() == null) {
            return Optional.empty();
        }
        String sym = candle.getSymbol().toUpperCase();
        String tf = candle.getTimeframe();
        Object lock = persistLocks.computeIfAbsent(lockKey(sym, tf, candle.getOpenTime()), k -> new Object());
        synchronized (lock) {
            try {
                if (candleRepository.existsBySymbolAndTimeframeAndOpenTime(sym, tf, candle.getOpenTime())) {
                    return Optional.empty();
                }
                int inserted = candleRepository.insertIgnoreDuplicate(candle);
                if (inserted > 0) {
                    return candleRepository.findBySymbolAndTimeframeAndOpenTime(sym, tf, candle.getOpenTime());
                }
                return Optional.empty();
            } catch (DataIntegrityViolationException ex) {
                log.debug("Candle duplicate for {} at {}", sym, candle.getOpenTime());
                return Optional.empty();
            } finally {
                persistLocks.remove(lockKey(sym, tf, candle.getOpenTime()));
            }
        }
    }

    private static String lockKey(String symbol, String timeframe, java.time.LocalDateTime openTime) {
        return symbol + "|" + timeframe + "|" + openTime;
    }
}
