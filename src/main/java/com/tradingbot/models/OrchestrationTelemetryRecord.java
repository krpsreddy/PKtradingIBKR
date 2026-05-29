package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Phase 189 — persisted orchestration decision for portfolio intelligence training. */
@Entity
@Table(name = "orchestration_telemetry", indexes = {
        @Index(name = "idx_orch_telemetry_symbol", columnList = "symbol"),
        @Index(name = "idx_orch_telemetry_state", columnList = "orchestration_state"),
        @Index(name = "idx_orch_telemetry_at", columnList = "recorded_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrchestrationTelemetryRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(length = 64)
    private String regime;

    @Column(name = "orchestration_state", nullable = false, length = 32)
    private String orchestrationState;

    @Column(length = 512)
    private String reason;

    private Integer conviction;
    private Integer dominance;
    private Integer persistence;

    @Column(name = "active_symbol", length = 16)
    private String activeSymbol;

    @Column(name = "replacement_advisory")
    private Boolean replacementAdvisory;

    @Column(name = "executed")
    private Boolean executed;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @PrePersist
    void prePersist() {
        if (recordedAt == null) recordedAt = Instant.now();
    }
}
