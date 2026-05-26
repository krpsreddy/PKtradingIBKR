package com.tradingbot.repository;

import com.tradingbot.models.SignalEvaluationSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface SignalEvaluationSnapshotRepository extends JpaRepository<SignalEvaluationSnapshot, Long> {

    List<SignalEvaluationSnapshot> findBySymbolAndTimestampAfterOrderByTimestampAsc(
            String symbol, LocalDateTime since);

    List<SignalEvaluationSnapshot> findBySymbolAndTimestampBetweenOrderByTimestampAsc(
            String symbol, LocalDateTime from, LocalDateTime to);
}
