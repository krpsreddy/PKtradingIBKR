package com.tradingbot.analytics.storage.repository;

import com.tradingbot.analytics.storage.entity.EvaluatedSignalSnapshotEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface EvaluatedSignalSnapshotRepository extends JpaRepository<EvaluatedSignalSnapshotEntity, Long> {

    Optional<EvaluatedSignalSnapshotEntity> findBySignalId(String signalId);

    long countByAnalyticsVersion(Integer analyticsVersion);

    @Query("SELECT e FROM EvaluatedSignalSnapshotEntity e WHERE " +
           "(:symbol IS NULL OR e.symbol = :symbol) AND " +
           "(:fromTs IS NULL OR e.timestampMs >= :fromTs) AND " +
           "(:toTs IS NULL OR e.timestampMs <= :toTs) AND " +
           "(:setup IS NULL OR e.setup = :setup) AND " +
           "(:regime IS NULL OR e.regime = :regime) AND " +
           "e.analyticsVersion = :version " +
           "ORDER BY e.timestampMs DESC")
    Page<EvaluatedSignalSnapshotEntity> querySnapshots(
            @Param("symbol") String symbol,
            @Param("fromTs") Long fromTs,
            @Param("toTs") Long toTs,
            @Param("setup") String setup,
            @Param("regime") String regime,
            @Param("version") Integer version,
            Pageable pageable);

    List<EvaluatedSignalSnapshotEntity> findBySymbolAndSessionDateGreaterThanEqualOrderByTimestampMsDesc(
            String symbol, LocalDate since);

    List<EvaluatedSignalSnapshotEntity> findByTimestampMsGreaterThanEqualAndAnalyticsVersionOrderByTimestampMsDesc(
            Long fromTs, Integer analyticsVersion, Pageable pageable);

    long countByTimestampMsGreaterThanEqualAndAnalyticsVersion(Long fromTs, Integer analyticsVersion);

    List<EvaluatedSignalSnapshotEntity> findBySymbolAndSessionDateGreaterThanEqualAndAnalyticsVersionOrderByTimestampMsDesc(
            String symbol, LocalDate since, Integer analyticsVersion);

    List<EvaluatedSignalSnapshotEntity> findBySymbolAndSessionDateAndAnalyticsVersionOrderByTimestampMsAsc(
            String symbol, LocalDate sessionDate, Integer analyticsVersion);

    long countBySymbol(String symbol);

    @Query("SELECT e FROM EvaluatedSignalSnapshotEntity e WHERE " +
           "(:symbol IS NULL OR e.symbol = :symbol) AND " +
           "(:fromTs IS NULL OR e.timestampMs >= :fromTs) AND " +
           "(:toTs IS NULL OR e.timestampMs <= :toTs) AND " +
           "(:decision IS NULL OR e.decision = :decision OR e.setup = :decision) AND " +
           "e.analyticsVersion = :version " +
           "ORDER BY e.timestampMs DESC")
    Page<EvaluatedSignalSnapshotEntity> searchSignals(
            @Param("symbol") String symbol,
            @Param("fromTs") Long fromTs,
            @Param("toTs") Long toTs,
            @Param("decision") String decision,
            @Param("version") Integer version,
            Pageable pageable);
}
