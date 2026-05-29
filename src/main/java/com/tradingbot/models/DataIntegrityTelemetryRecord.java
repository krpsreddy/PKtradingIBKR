package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Phase 205 — persisted integrity events (append-only). */
@Entity
@Table(name = "data_integrity_telemetry", indexes = {
        @Index(name = "idx_data_integrity_event", columnList = "event_type"),
        @Index(name = "idx_data_integrity_at", columnList = "recorded_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DataIntegrityTelemetryRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", nullable = false, length = 48)
    private String eventType;

    @Column(length = 512)
    private String detail;

    @Column(name = "integrity_state", length = 24)
    private String integrityState;

    @Column(name = "integrity_score")
    private Integer integrityScore;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;
}
