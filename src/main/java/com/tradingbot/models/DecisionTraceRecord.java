package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** Phase 201 — persisted explainable execution reasoning (append-only). */
@Entity
@Table(name = "decision_trace", indexes = {
        @Index(name = "idx_decision_trace_symbol", columnList = "symbol"),
        @Index(name = "idx_decision_trace_regime", columnList = "regime"),
        @Index(name = "idx_decision_trace_structure", columnList = "market_structure"),
        @Index(name = "idx_decision_trace_entry_quality", columnList = "entry_quality"),
        @Index(name = "idx_decision_trace_lifecycle", columnList = "lifecycle"),
        @Index(name = "idx_decision_trace_session", columnList = "session_type"),
        @Index(name = "idx_decision_trace_outcome", columnList = "outcome"),
        @Index(name = "idx_decision_trace_exec_date", columnList = "execution_date"),
        @Index(name = "idx_decision_trace_type", columnList = "decision_type"),
        @Index(name = "idx_decision_trace_at", columnList = "recorded_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DecisionTraceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "decision_type", nullable = false, length = 24)
    private String decisionType;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(length = 64)
    private String regime;

    @Column(name = "market_structure", length = 128)
    private String marketStructure;

    @Column(name = "entry_quality", length = 32)
    private String entryQuality;

    @Column(length = 32)
    private String lifecycle;

    @Column(name = "session_type", length = 32)
    private String sessionType;

    @Column(length = 32)
    private String outcome;

    @Column(name = "execution_date")
    private LocalDate executionDate;

    @Column(name = "orchestration_state", length = 32)
    private String orchestrationState;

    @Column(name = "exit_state", length = 32)
    private String exitState;

    private Integer conviction;
    private Integer dominance;
    private Integer persistence;

    @Column(precision = 8, scale = 3)
    private BigDecimal rvol;

    @Column(name = "realized_r", precision = 10, scale = 4)
    private BigDecimal realizedR;

    @Column(name = "continuation_capture_pct", precision = 8, scale = 4)
    private BigDecimal continuationCapturePct;

    @Column(name = "paper_execution_id")
    private Long paperExecutionId;

    @Column(name = "telemetry_id")
    private Long telemetryId;

    @Column(name = "rejection_category", length = 64)
    private String rejectionCategory;

    @Column(name = "narrative", length = 2048)
    private String narrative;

    @Column(name = "snapshot_json", columnDefinition = "TEXT")
    private String snapshotJson;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (recordedAt == null) recordedAt = now;
        if (executionDate == null) recordedAt.atZone(java.time.ZoneId.of("America/New_York")).toLocalDate();
    }
}
