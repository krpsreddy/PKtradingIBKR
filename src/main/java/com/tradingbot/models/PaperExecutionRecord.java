package com.tradingbot.models;

import com.tradingbot.paper.PaperExecutionMode;
import com.tradingbot.paper.PaperExecutionStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

/** Phase 181 — persisted paper research execution (separate from replay cache). */
@Entity
@Table(name = "paper_execution_records", indexes = {
        @Index(name = "idx_paper_exec_symbol", columnList = "symbol"),
        @Index(name = "idx_paper_exec_status", columnList = "status"),
        @Index(name = "idx_paper_exec_submitted", columnList = "submitted_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaperExecutionRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(nullable = false, length = 64)
    private String regime;

    @Enumerated(EnumType.STRING)
    @Column(name = "execution_mode", nullable = false, length = 32)
    private PaperExecutionMode executionMode;

    /** Phase 221 — PAPER vs LIVE JVM isolation tag for future DB split. */
    @Column(name = "runtime_profile", length = 16)
    private String runtimeProfile;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private PaperExecutionStatus status;

    @Column(name = "plan_source", length = 32)
    private String planSource;

    @Column(name = "entry_price", precision = 18, scale = 6)
    private BigDecimal entryPrice;

    @Column(name = "fill_price", precision = 18, scale = 6)
    private BigDecimal fillPrice;

    @Column(precision = 18, scale = 6)
    private BigDecimal slippage;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "ibkr_order_id")
    private Integer ibkrOrderId;

    @Column(name = "order_type", length = 16)
    private String orderType;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "filled_at")
    private Instant filledAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "entry_latency_ms")
    private Long entryLatencyMs;

    @Column(name = "mfe_r", precision = 10, scale = 4)
    private BigDecimal mfeR;

    @Column(name = "mae_r", precision = 10, scale = 4)
    private BigDecimal maeR;

    @Column(name = "realized_r", precision = 10, scale = 4)
    private BigDecimal realizedR;

    @Column(name = "continuation_survival")
    private Boolean continuationSurvival;

    @Column(name = "persistence_duration_sec")
    private Integer persistenceDurationSec;

    @Column(name = "second_leg_captured")
    private Boolean secondLegCaptured;

    @Column(name = "post_exit_continuation_r", precision = 10, scale = 4)
    private BigDecimal postExitContinuationR;

    @Column(name = "exit_quality_note", length = 512)
    private String exitQualityNote;

    @Column(name = "conviction_score")
    private Integer convictionScore;

    @Column(name = "dominance_score")
    private Integer dominanceScore;

    @Column(name = "execution_quality")
    private Integer executionQuality;

    @Column(name = "blocked_reason", length = 512)
    private String blockedReason;

    @Column(name = "exit_suggestion", length = 256)
    private String exitSuggestion;

    @Column(name = "limit_entry_price", precision = 18, scale = 6)
    private BigDecimal limitEntryPrice;

    @Column(name = "structural_stop_price", precision = 18, scale = 6)
    private BigDecimal structuralStopPrice;

    @Column(name = "trailing_stop_price", precision = 18, scale = 6)
    private BigDecimal trailingStopPrice;

    @Column(name = "fill_quality", length = 16)
    private String fillQuality;

    @Column(name = "entry_style", length = 32)
    private String entryStyle;

    @Column(name = "simulated_fill")
    private Boolean simulatedFill;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
