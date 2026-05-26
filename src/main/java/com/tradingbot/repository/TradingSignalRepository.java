package com.tradingbot.repository;

import com.tradingbot.models.TradingSignal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TradingSignalRepository extends JpaRepository<TradingSignal, Long> {

    Optional<TradingSignal> findFirstBySymbolAndSignalTypeAndTimestampAfter(
            String symbol, String signalType, LocalDateTime after);

    List<TradingSignal> findByTimestampAfterOrderByTimestampDesc(LocalDateTime after);

    List<TradingSignal> findBySymbolOrderByTimestampDesc(String symbol);

    List<TradingSignal> findBySymbolAndTimestampAfterOrderByTimestampDesc(String symbol, LocalDateTime after);
}
