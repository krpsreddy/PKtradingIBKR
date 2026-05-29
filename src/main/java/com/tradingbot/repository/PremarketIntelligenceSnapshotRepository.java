package com.tradingbot.repository;

import com.tradingbot.models.PremarketIntelligenceSnapshotRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PremarketIntelligenceSnapshotRepository extends JpaRepository<PremarketIntelligenceSnapshotRecord, Long> {

    List<PremarketIntelligenceSnapshotRecord> findTop50ByOrderByRecordedAtDesc();
}
