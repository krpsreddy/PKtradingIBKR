package com.tradingbot.analytics.storage.repository;

import com.tradingbot.analytics.storage.entity.PlaybookCandidateEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlaybookCandidateRepository extends JpaRepository<PlaybookCandidateEntity, Long> {

    Optional<PlaybookCandidateEntity> findByCandidateId(String candidateId);

    List<PlaybookCandidateEntity> findByAnalyticsVersionOrderByQualityScoreDesc(Integer analyticsVersion);

    long countByAnalyticsVersion(Integer analyticsVersion);
}
