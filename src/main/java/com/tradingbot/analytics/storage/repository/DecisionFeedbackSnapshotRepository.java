package com.tradingbot.analytics.storage.repository;

import com.tradingbot.analytics.storage.entity.DecisionFeedbackSnapshotEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DecisionFeedbackSnapshotRepository extends JpaRepository<DecisionFeedbackSnapshotEntity, Long> {

    Optional<DecisionFeedbackSnapshotEntity> findBySignalId(String signalId);

    List<DecisionFeedbackSnapshotEntity> findByAnalyticsVersionOrderByCreatedAtDesc(Integer analyticsVersion);
}
