package com.tradingbot.repository;

import com.tradingbot.models.ExecutionTelemetryRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ExecutionTelemetryRepository extends JpaRepository<ExecutionTelemetryRecord, Long> {

    Optional<ExecutionTelemetryRecord> findByPaperExecutionId(Long paperExecutionId);

    List<ExecutionTelemetryRecord> findTop50ByOrderByOpenedAtDesc();

    List<ExecutionTelemetryRecord> findTop200ByClosedAtNotNullOrderByClosedAtDesc();

    List<ExecutionTelemetryRecord> findByClosedAtNotNullOrderByClosedAtDesc();

    List<ExecutionTelemetryRecord> findByClosedAtBetweenOrderByClosedAtDesc(Instant from, Instant to);

    List<ExecutionTelemetryRecord> findByOpenedAtBetweenOrderByOpenedAtDesc(Instant from, Instant to);
}
