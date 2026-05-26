package com.tradingbot.replay.cache.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "replay_session_snapshots", indexes = {
        @Index(name = "idx_replay_snap_symbol", columnList = "symbol"),
        @Index(name = "idx_replay_snap_session", columnList = "session_date"),
        @Index(name = "idx_replay_snap_version", columnList = "analytics_version"),
        @Index(name = "idx_replay_snap_status", columnList = "replay_status"),
        @Index(name = "idx_replay_snap_symbol_session", columnList = "symbol, session_date")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_replay_snap_symbol_session", columnNames = {"symbol", "session_date"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReplaySessionSnapshotEntity {

    public enum ReplayStatus {
        READY, STALE, PROCESSING, FAILED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(name = "session_date", nullable = false)
    private LocalDate sessionDate;

    @Column(name = "analytics_version", nullable = false)
    private Integer analyticsVersion;

    @Column(name = "candles_hash", nullable = false, length = 64)
    private String candlesHash;

    @Column(name = "session_hash", length = 64)
    private String sessionHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "replay_status", nullable = false, length = 16)
    private ReplayStatus replayStatus;

    /** Full ReplayHistoryDto JSON — canonical replay payload. */
    @Column(name = "replay_payload_json", nullable = false, columnDefinition = "TEXT")
    private String replayPayloadJson;

    @Column(name = "timeline_json", columnDefinition = "TEXT")
    private String timelineJson;

    @Column(name = "indicator_snapshot_json", columnDefinition = "TEXT")
    private String indicatorSnapshotJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        if (replayStatus == null) replayStatus = ReplayStatus.READY;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
