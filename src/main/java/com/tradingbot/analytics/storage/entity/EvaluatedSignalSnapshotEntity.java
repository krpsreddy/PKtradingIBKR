package com.tradingbot.analytics.storage.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "evaluated_signal_snapshots", indexes = {
        @Index(name = "idx_eval_snap_symbol", columnList = "symbol"),
        @Index(name = "idx_eval_snap_timestamp", columnList = "timestamp_ms"),
        @Index(name = "idx_eval_snap_session", columnList = "session_date"),
        @Index(name = "idx_eval_snap_setup", columnList = "setup"),
        @Index(name = "idx_eval_snap_regime", columnList = "regime"),
        @Index(name = "idx_eval_snap_decision", columnList = "decision"),
        @Index(name = "idx_eval_snap_narrative", columnList = "narrative_path"),
        @Index(name = "idx_eval_snap_win_loss", columnList = "win_loss"),
        @Index(name = "idx_eval_snap_conviction", columnList = "conviction"),
        @Index(name = "idx_eval_snap_mfe", columnList = "mfe"),
        @Index(name = "idx_eval_snap_symbol_ts", columnList = "symbol, timestamp_ms")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_eval_snap_signal_id", columnNames = "signal_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EvaluatedSignalSnapshotEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "signal_id", nullable = false, length = 128)
    private String signalId;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(name = "timestamp_ms", nullable = false)
    private Long timestampMs;

    @Column(name = "session_date")
    private LocalDate sessionDate;

    @Column(length = 32)
    private String setup;

    @Column(length = 32)
    private String regime;

    @Column(name = "market_condition", length = 64)
    private String marketCondition;

    @Column(name = "narrative_path", length = 512)
    private String narrativePath;

    @Column(length = 32)
    private String decision;

    @Column(length = 16)
    private String conviction;

    @Column(name = "decision_reason", length = 256)
    private String decisionReason;

    @Column(name = "execution_quality", length = 32)
    private String executionQuality;

    @Column(name = "entry_location_quality", length = 32)
    private String entryLocationQuality;

    @Column(name = "continuation_health", length = 32)
    private String continuationHealth;

    private Double mfe;
    private Double mae;

    @Column(name = "continuation_percent")
    private Double continuationPercent;

    private Boolean fakeout;

    @Column(name = "win_loss", length = 16)
    private String winLoss;

    @Column(name = "lifecycle_state", length = 32)
    private String lifecycleState;

    @Column(name = "outcome_attribution", length = 64)
    private String outcomeAttribution;

    @Column(name = "playbook_tags", columnDefinition = "TEXT")
    private String playbookTags;

    @Column(name = "narrative_tags", columnDefinition = "TEXT")
    private String narrativeTags;

    @Column(name = "analytics_version", nullable = false)
    private Integer analyticsVersion;

    /** Full canonical SignalSnapshot JSON payload. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
