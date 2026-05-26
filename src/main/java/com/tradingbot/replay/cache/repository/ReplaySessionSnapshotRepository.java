package com.tradingbot.replay.cache.repository;

import com.tradingbot.replay.cache.entity.ReplaySessionSnapshotEntity;
import com.tradingbot.replay.cache.entity.ReplaySessionSnapshotEntity.ReplayStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ReplaySessionSnapshotRepository extends JpaRepository<ReplaySessionSnapshotEntity, Long> {

    Optional<ReplaySessionSnapshotEntity> findBySymbolAndSessionDate(String symbol, LocalDate sessionDate);

    List<ReplaySessionSnapshotEntity> findBySymbolAndSessionDateGreaterThanEqualOrderBySessionDateAsc(
            String symbol, LocalDate cutoff);

    List<ReplaySessionSnapshotEntity> findBySymbolAndReplayStatus(String symbol, ReplayStatus status);

    long countBySymbolAndReplayStatus(String symbol, ReplayStatus status);
}
