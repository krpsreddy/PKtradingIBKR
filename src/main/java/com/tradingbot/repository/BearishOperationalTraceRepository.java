package com.tradingbot.repository;

import com.tradingbot.models.BearishOperationalTraceRecord;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BearishOperationalTraceRepository extends JpaRepository<BearishOperationalTraceRecord, Long> {
}
