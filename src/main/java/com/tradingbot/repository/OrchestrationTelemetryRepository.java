package com.tradingbot.repository;

import com.tradingbot.models.OrchestrationTelemetryRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface OrchestrationTelemetryRepository extends JpaRepository<OrchestrationTelemetryRecord, Long> {

    List<OrchestrationTelemetryRecord> findTop100ByOrderByRecordedAtDesc();

    List<OrchestrationTelemetryRecord> findTop500ByOrderByRecordedAtDesc();

    List<OrchestrationTelemetryRecord> findByRecordedAtBetweenOrderByRecordedAtDesc(Instant from, Instant to);
}
