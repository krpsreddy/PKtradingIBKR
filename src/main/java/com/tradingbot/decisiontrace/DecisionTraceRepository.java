package com.tradingbot.decisiontrace;

import com.tradingbot.models.DecisionTraceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Phase 201 — queryable execution reasoning store. */
public interface DecisionTraceRepository extends JpaRepository<DecisionTraceRecord, Long> {

    List<DecisionTraceRecord> findTop100BySymbolOrderByRecordedAtDesc(String symbol);

    List<DecisionTraceRecord> findTop200ByDecisionTypeOrderByRecordedAtDesc(String decisionType);

    List<DecisionTraceRecord> findByExecutionDateOrderByRecordedAtDesc(LocalDate executionDate);

    @Query("""
            SELECT d FROM DecisionTraceRecord d
            WHERE d.decisionType IN ('EXIT', 'ENTRY')
              AND d.persistence >= :minPersistence
              AND d.marketStructure LIKE CONCAT('%', :structureFragment, '%')
            ORDER BY d.recordedAt DESC
            """)
    List<DecisionTraceRecord> findClosedWithPersistenceAndStructure(
            @Param("minPersistence") int minPersistence,
            @Param("structureFragment") String structureFragment
    );

    List<DecisionTraceRecord> findTop500ByDecisionTypeInAndRegimeContainingOrderByRecordedAtDesc(
            List<String> decisionTypes,
            String regimeFragment
    );

    long countByDecisionTypeAndRejectionCategoryAndExecutionDate(
            String decisionType,
            String rejectionCategory,
            LocalDate executionDate
    );

    java.util.Optional<DecisionTraceRecord> findFirstByPaperExecutionIdAndDecisionTypeOrderByRecordedAtDesc(
            Long paperExecutionId,
            String decisionType
    );

    List<DecisionTraceRecord> findByRecordedAtBetweenOrderByRecordedAtDesc(Instant from, Instant to);
}
