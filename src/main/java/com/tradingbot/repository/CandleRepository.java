package com.tradingbot.repository;

import com.tradingbot.models.Candle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface CandleRepository extends JpaRepository<Candle, Long> {

    List<Candle> findBySymbolAndTimeframeOrderByOpenTimeAsc(String symbol, String timeframe);

    /** Loads up to 5000 most recent bars (~60 trading days of 5m RTH). */
    List<Candle> findTop5000BySymbolAndTimeframeOrderByOpenTimeDesc(String symbol, String timeframe);

    /** @deprecated use findTop5000BySymbolAndTimeframeOrderByOpenTimeDesc */
    @Deprecated
    default List<Candle> findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(String symbol, String timeframe) {
        return findTop5000BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, timeframe);
    }

    List<Candle> findBySymbolAndTimeframeAndOpenTimeGreaterThanEqualOrderByOpenTimeAsc(
            String symbol, String timeframe, LocalDateTime since);

    long countBySymbolAndTimeframe(String symbol, String timeframe);

    boolean existsBySymbolAndTimeframeAndOpenTime(String symbol, String timeframe, LocalDateTime openTime);

    Optional<Candle> findBySymbolAndTimeframeAndOpenTime(String symbol, String timeframe, LocalDateTime openTime);

    @Modifying
    @Query(value = """
            INSERT INTO candles (symbol, timeframe, open, high, low, close, volume, open_time, close_time)
            VALUES (:symbol, :timeframe, :open, :high, :low, :close, :volume, :openTime, :closeTime)
            ON CONFLICT (symbol, timeframe, open_time) DO NOTHING
            """, nativeQuery = true)
    int insertIgnoreDuplicate(@Param("symbol") String symbol,
                              @Param("timeframe") String timeframe,
                              @Param("open") java.math.BigDecimal open,
                              @Param("high") java.math.BigDecimal high,
                              @Param("low") java.math.BigDecimal low,
                              @Param("close") java.math.BigDecimal close,
                              @Param("volume") Long volume,
                              @Param("openTime") LocalDateTime openTime,
                              @Param("closeTime") LocalDateTime closeTime);

    default int insertIgnoreDuplicate(Candle candle) {
        return insertIgnoreDuplicate(
                candle.getSymbol().toUpperCase(),
                candle.getTimeframe(),
                candle.getOpen(),
                candle.getHigh(),
                candle.getLow(),
                candle.getClose(),
                candle.getVolume(),
                candle.getOpenTime(),
                candle.getCloseTime()
        );
    }

    @Modifying
    @Query("DELETE FROM Candle c WHERE c.symbol = :symbol AND c.timeframe = :timeframe AND c.openTime < :before")
    int deleteOlderThan(@Param("symbol") String symbol,
                        @Param("timeframe") String timeframe,
                        @Param("before") LocalDateTime before);
}
