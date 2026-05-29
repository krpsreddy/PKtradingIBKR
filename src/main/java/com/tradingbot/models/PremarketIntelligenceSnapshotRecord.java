package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Phase 211 — summarized PM intelligence (not raw candles). */
@Entity
@Table(name = "premarket_intelligence_snapshot", indexes = {
        @Index(name = "idx_pm_intel_symbol", columnList = "symbol"),
        @Index(name = "idx_pm_intel_recorded", columnList = "recorded_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PremarketIntelligenceSnapshotRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(name = "session_date", length = 16)
    private String sessionDate;

    @Column(name = "trend_state", length = 32)
    private String trendState;

    @Column(name = "gap_pct")
    private Double gapPct;

    @Column(name = "quality_score")
    private Integer qualityScore;

    @Column(name = "persistence")
    private Integer persistence;

    @Column(name = "opening_continuation_prob")
    private Integer openingContinuationProb;

    @Column(name = "pm_structure", length = 64)
    private String pmStructure;

    @Column(name = "open_transition_outcome", length = 64)
    private String openTransitionOutcome;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @PrePersist
    void prePersist() {
        if (recordedAt == null) recordedAt = Instant.now();
    }
}
