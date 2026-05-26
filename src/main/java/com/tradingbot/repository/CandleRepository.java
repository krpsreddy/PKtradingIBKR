package com.tradingbot.repository;

import com.tradingbot.models.Candle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

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

    @Modifying
    @Query("DELETE FROM Candle c WHERE c.symbol = :symbol AND c.timeframe = :timeframe AND c.openTime < :before")
    int deleteOlderThan(@Param("symbol") String symbol,
                        @Param("timeframe") String timeframe,
                        @Param("before") LocalDateTime before);
}
