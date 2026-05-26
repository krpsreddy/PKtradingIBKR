package com.tradingbot.analytics.storage.repository;

import com.tradingbot.analytics.storage.entity.HydrationSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HydrationSessionRepository extends JpaRepository<HydrationSessionEntity, Long> {

    Optional<HydrationSessionEntity> findBySymbol(String symbol);

    List<HydrationSessionEntity> findAllByOrderBySymbolAsc();
}
