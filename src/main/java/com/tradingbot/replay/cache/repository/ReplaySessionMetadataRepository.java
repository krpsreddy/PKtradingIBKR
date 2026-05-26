package com.tradingbot.replay.cache.repository;

import com.tradingbot.replay.cache.entity.ReplaySessionMetadataEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ReplaySessionMetadataRepository extends JpaRepository<ReplaySessionMetadataEntity, Long> {

    Optional<ReplaySessionMetadataEntity> findBySymbolAndSessionDate(String symbol, LocalDate sessionDate);

    List<ReplaySessionMetadataEntity> findBySymbolAndSessionDateGreaterThanEqualOrderBySessionDateAsc(
            String symbol, LocalDate cutoff);
}
