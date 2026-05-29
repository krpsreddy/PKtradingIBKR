package com.tradingbot.repository;

import com.tradingbot.models.DataIntegrityTelemetryRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DataIntegrityTelemetryRepository extends JpaRepository<DataIntegrityTelemetryRecord, Long> {

    List<DataIntegrityTelemetryRecord> findTop50ByOrderByRecordedAtDesc();
}
