package com.tradingbot.repository;

import com.tradingbot.models.IndicatorSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IndicatorSnapshotRepository extends JpaRepository<IndicatorSnapshot, Long> {
}
