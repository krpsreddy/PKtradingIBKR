package com.tradingbot.repository;

import com.tradingbot.models.TradingSymbol;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface TradingSymbolRepository extends JpaRepository<TradingSymbol, Long> {

    List<TradingSymbol> findByActiveTrueOrderByPinnedDescDisplayOrderAscSymbolAsc();

    List<TradingSymbol> findByActiveTrueAndEnabledTrueOrderByPinnedDescDisplayOrderAscSymbolAsc();

    List<TradingSymbol> findByActiveTrueAndEnabledTrueAndScanEnabledTrueOrderByDisplayOrderAscSymbolAsc();

    List<TradingSymbol> findByActiveTrueAndEnabledTrueAndPreloadOnStartupTrueOrderByDisplayOrderAscSymbolAsc();

    List<TradingSymbol> findByActiveTrueAndEnabledTrueAndSubscribeLiveTrueOrderByDisplayOrderAscSymbolAsc();

    boolean existsBySymbolIgnoreCase(String symbol);

    Optional<TradingSymbol> findBySymbolIgnoreCase(String symbol);

    @Query("SELECT COALESCE(MAX(t.displayOrder), 0) FROM TradingSymbol t WHERE t.active = true")
    int maxDisplayOrder();
}
