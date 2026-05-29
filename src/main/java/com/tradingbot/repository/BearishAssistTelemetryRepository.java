package com.tradingbot.repository;

import com.tradingbot.models.BearishAssistTelemetryRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface BearishAssistTelemetryRepository extends JpaRepository<BearishAssistTelemetryRecord, Long> {

    List<BearishAssistTelemetryRecord> findTop100BySymbolOrderByRecordedAtDesc(String symbol);

    List<BearishAssistTelemetryRecord> findByRecordedAtBetweenOrderByRecordedAtDesc(Instant from, Instant to);
}
