package com.tradingbot.repository;

import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.paper.PaperExecutionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PaperExecutionRecordRepository extends JpaRepository<PaperExecutionRecord, Long> {

    List<PaperExecutionRecord> findByStatusInOrderBySubmittedAtDesc(List<PaperExecutionStatus> statuses);

    List<PaperExecutionRecord> findAllByOrderBySubmittedAtDesc();

    Optional<PaperExecutionRecord> findTopBySymbolAndRegimeAndSubmittedAtAfterOrderBySubmittedAtDesc(
            String symbol, String regime, Instant after);

    List<PaperExecutionRecord> findBySymbolAndStatus(String symbol, PaperExecutionStatus status);

    Optional<PaperExecutionRecord> findByIbkrOrderId(Integer ibkrOrderId);
}
