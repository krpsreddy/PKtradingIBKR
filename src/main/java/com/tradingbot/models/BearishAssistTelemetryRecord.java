package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Phase 202 — PUT assist trigger telemetry (advisory only). */
@Entity
@Table(name = "bearish_assist_telemetry", indexes = {
        @Index(name = "idx_bearish_assist_symbol", columnList = "symbol"),
        @Index(name = "idx_bearish_assist_at", columnList = "recorded_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BearishAssistTelemetryRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(length = 64)
    private String regime;

    @Column(name = "bearish_bias")
    private Integer bearishBias;

    @Column(name = "bearish_state", length = 32)
    private String bearishState;

    @Column(name = "breakdown_probability", length = 16)
    private String breakdownProbability;

    @Column(length = 16)
    private String confidence;

    @Column(length = 1024)
    private String reasons;

    @Column(length = 2048)
    private String narrative;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @PrePersist
    void prePersist() {
        if (recordedAt == null) recordedAt = Instant.now();
    }
}
