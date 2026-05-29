package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

/** Phase 188 — persisted autonomous paper execution telemetry. */
@Entity
@Table(name = "execution_telemetry", indexes = {
        @Index(name = "idx_exec_telemetry_symbol", columnList = "symbol"),
        @Index(name = "idx_exec_telemetry_regime", columnList = "regime"),
        @Index(name = "idx_exec_telemetry_opened", columnList = "opened_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExecutionTelemetryRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "paper_execution_id")
    private Long paperExecutionId;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(nullable = false, length = 64)
    private String regime;

    @Column(name = "opened_at", nullable = false)
    private Instant openedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "conviction")
    private Integer conviction;

    @Column(name = "dominance")
    private Integer dominance;

    @Column(name = "persistence")
    private Integer persistence;

    @Column(name = "rvol", precision = 8, scale = 3)
    private BigDecimal rvol;

    @Column(name = "velocity")
    private Integer velocity;

    @Column(name = "lifecycle", length = 32)
    private String lifecycle;

    @Column(name = "execution_quality", length = 24)
    private String executionQuality;

    @Column(name = "entry_reason", length = 128)
    private String entryReason;

    @Column(name = "entry_price", precision = 18, scale = 6)
    private BigDecimal entryPrice;

    @Column(name = "stop_price", precision = 18, scale = 6)
    private BigDecimal stopPrice;

    @Column(name = "target_price", precision = 18, scale = 6)
    private BigDecimal targetPrice;

    @Column(name = "mfe_r", precision = 10, scale = 4)
    private BigDecimal mfeR;

    @Column(name = "mae_r", precision = 10, scale = 4)
    private BigDecimal maeR;

    @Column(name = "hold_duration_sec")
    private Integer holdDurationSec;

    @Column(name = "exit_reason", length = 128)
    private String exitReason;

    @Column(name = "realized_r", precision = 10, scale = 4)
    private BigDecimal realizedR;

    @Column(name = "market_regime", length = 64)
    private String marketRegime;

    @Column(name = "session_period", length = 32)
    private String sessionPeriod;

    @Column(name = "entry_offset_pct", precision = 8, scale = 4)
    private BigDecimal entryOffsetPct;

    @Column(name = "fill_probability")
    private Integer fillProbability;

    @Column(name = "slippage_pct", precision = 8, scale = 4)
    private BigDecimal slippagePct;

    @Column(name = "fill_latency_ms")
    private Long fillLatencyMs;

    @Column(name = "fill_quality", length = 16)
    private String fillQuality;

    @Column(name = "spread_estimate", precision = 10, scale = 6)
    private BigDecimal spreadEstimate;

    @Column(name = "directional_conflict", length = 16)
    private String directionalConflict;

    @Column(name = "long_suppression", length = 16)
    private String longSuppression;

    @Column(name = "deterioration_state", length = 24)
    private String deteriorationState;

    @Column(name = "entry_style", length = 32)
    private String entryStyle;

    @Column(name = "trailing_state", length = 128)
    private String trailingState;

    @Column(name = "trailing_efficiency", precision = 8, scale = 4)
    private BigDecimal trailingEfficiency;

    @Column(name = "continuation_capture_pct", precision = 8, scale = 2)
    private BigDecimal continuationCapturePct;

    @Column(name = "premature_exit")
    private Boolean prematureExit;

    @Column(name = "overstayed_trade")
    private Boolean overstayedTrade;

    @Column(name = "slippage_penalty", precision = 8, scale = 4)
    private BigDecimal slippagePenalty;

    @Column(name = "execution_score")
    private Integer executionScore;

    @Column(name = "execution_grade", length = 16)
    private String executionGrade;

    @Column(name = "entry_quality_grade", length = 16)
    private String entryQualityGrade;

    @Column(name = "fill_quality_grade", length = 16)
    private String fillQualityGrade;

    @Column(name = "exit_quality_grade", length = 16)
    private String exitQualityGrade;

    @Column(name = "unrealized_peak_r", precision = 10, scale = 4)
    private BigDecimal unrealizedPeakR;

    @Column(name = "market_structure", length = 64)
    private String marketStructure;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        if (openedAt == null) openedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
