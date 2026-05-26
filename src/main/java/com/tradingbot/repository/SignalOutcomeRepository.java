package com.tradingbot.repository;

import com.tradingbot.models.SignalOutcome;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface SignalOutcomeRepository extends JpaRepository<SignalOutcome, Long> {
    List<SignalOutcome> findBySessionDateOrderByRecordedAtDesc(LocalDate sessionDate);
    List<SignalOutcome> findBySymbolOrderByRecordedAtDesc(String symbol);

    List<SignalOutcome> findBySymbolAndSessionDateGreaterThanEqualOrderBySessionDateDesc(String symbol, LocalDate since);

    List<SignalOutcome> findBySessionDateGreaterThanEqualOrderBySessionDateDesc(LocalDate since);

    List<SignalOutcome> findBySetupTypeAndSessionDateGreaterThanEqual(String setupType, LocalDate since);

    @Query("SELECT o FROM SignalOutcome o WHERE o.sessionDate >= :since ORDER BY o.sessionDate DESC")
    List<SignalOutcome> findSince(@Param("since") LocalDate since);

    @Query("SELECT o.setupType, o.regime, o.outcome, COUNT(o) FROM SignalOutcome o " +
           "WHERE o.sessionDate >= :since GROUP BY o.setupType, o.regime, o.outcome")
    List<Object[]> aggregateBySetupRegime(@Param("since") LocalDate since);

    @Query("SELECT o.setupType, o.outcome, COUNT(o) FROM SignalOutcome o " +
           "WHERE o.sessionDate = :date GROUP BY o.setupType, o.outcome")
    List<Object[]> dailySetupStats(@Param("date") LocalDate date);

    @Query("SELECT o.setupType, o.timeOfDay, o.outcome, COUNT(o) FROM SignalOutcome o " +
           "WHERE o.sessionDate >= :since GROUP BY o.setupType, o.timeOfDay, o.outcome")
    List<Object[]> aggregateBySetupTime(@Param("since") LocalDate since);

    @Query("SELECT o.setupType, o.sector, o.outcome, COUNT(o) FROM SignalOutcome o " +
           "WHERE o.sessionDate >= :since AND o.sector IS NOT NULL GROUP BY o.setupType, o.sector, o.outcome")
    List<Object[]> aggregateBySetupSector(@Param("since") LocalDate since);

    @Query("SELECT AVG(o.rrAchieved), AVG(o.maxFavorableExcursion), AVG(o.durationMinutes), AVG(o.continuationDistance) " +
           "FROM SignalOutcome o WHERE o.setupType = :setup AND o.sessionDate >= :since AND o.outcome = 'WIN'")
    Object[] avgWinMetrics(@Param("setup") String setup, @Param("since") LocalDate since);
}
