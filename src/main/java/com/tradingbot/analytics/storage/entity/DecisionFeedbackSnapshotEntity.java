package com.tradingbot.analytics.storage.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "decision_feedback_snapshots", indexes = {
        @Index(name = "idx_dec_fb_signal", columnList = "signal_id"),
        @Index(name = "idx_dec_fb_decision", columnList = "decision")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_dec_fb_signal_id", columnNames = "signal_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DecisionFeedbackSnapshotEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "signal_id", nullable = false, length = 128)
    private String signalId;

    @Column(length = 32)
    private String decision;

    @Column(name = "conviction_band", length = 16)
    private String convictionBand;

    @Column(name = "actual_outcome", length = 16)
    private String actualOutcome;

    private Boolean correctness;

    @Column(name = "regret_score")
    private Double regretScore;

    @Column(name = "false_avoid")
    private Boolean falseAvoid;

    @Column(name = "false_trap")
    private Boolean falseTrap;

    @Column(name = "wait_benefit")
    private Double waitBenefit;

    @Column(name = "analytics_version", nullable = false)
    private Integer analyticsVersion;

    @Column(columnDefinition = "TEXT")
    private String payload;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
