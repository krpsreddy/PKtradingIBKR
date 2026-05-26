package com.tradingbot.analytics.storage.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "hydration_sessions", indexes = {
        @Index(name = "idx_hydration_symbol", columnList = "symbol"),
        @Index(name = "idx_hydration_status", columnList = "status")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_hydration_symbol", columnNames = "symbol")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HydrationSessionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(name = "lookback_days")
    private Integer lookbackDays;

    @Column(name = "candles_loaded")
    private Integer candlesLoaded;

    @Column(name = "signals_evaluated")
    private Integer signalsEvaluated;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private HydrationStatus status;

    @Column(name = "evaluated_session_dates", columnDefinition = "TEXT")
    private String evaluatedSessionDates;

    @Column(name = "analytics_version", nullable = false)
    private Integer analyticsVersion;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    public enum HydrationStatus {
        READY, PARTIAL, FAILED, PROCESSING
    }
}
