package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "signal_evaluation_snapshot", indexes = {
        @Index(name = "idx_eval_symbol_ts", columnList = "symbol, timestamp")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SignalEvaluationSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(name = "signal_type", nullable = false, length = 32)
    private String signalType;

    @Column(name = "lifecycle_state", length = 32)
    private String lifecycleState;

    private Integer score;

    @Column(name = "passed_conditions", length = 1024)
    private String passedConditions;

    @Column(name = "failed_conditions", length = 1024)
    private String failedConditions;

    @Column(precision = 18, scale = 6)
    private BigDecimal price;

    private Long volume;

    @Column(precision = 18, scale = 4)
    private BigDecimal rvol;

    @Column(name = "vwap_state", length = 32)
    private String vwapState;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
