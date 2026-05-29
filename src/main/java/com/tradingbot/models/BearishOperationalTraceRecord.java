package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Phase 209 — persisted bearish operational reasoning. */
@Entity
@Table(name = "bearish_operational_trace", indexes = {
        @Index(name = "idx_bearish_ops_symbol", columnList = "symbol"),
        @Index(name = "idx_bearish_ops_at", columnList = "recorded_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BearishOperationalTraceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(name = "bearish_regime", length = 48)
    private String bearishRegime;

    @Column(name = "suppression_level", length = 16)
    private String suppressionLevel;

    @Column(name = "deterioration_level", length = 16)
    private String deteriorationLevel;

    @Column(name = "put_grade", length = 16)
    private String putGrade;

    @Column(name = "conflict_level", length = 16)
    private String conflictLevel;

    @Column(length = 16)
    private String environment;

    @Column(name = "rejection_persistence")
    private Integer rejectionPersistence;

    @Column(name = "reclaim_failure")
    private Integer reclaimFailure;

    @Column(name = "downside_rvol")
    private Double downsideRvol;

    @Column(name = "breakdown_acceleration")
    private Integer breakdownAcceleration;

    @Column(name = "decision_narrative", length = 1024)
    private String decisionNarrative;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;
}
