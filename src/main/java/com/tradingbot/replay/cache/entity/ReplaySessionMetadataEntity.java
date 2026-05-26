package com.tradingbot.replay.cache.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "replay_session_metadata", indexes = {
        @Index(name = "idx_replay_meta_symbol", columnList = "symbol"),
        @Index(name = "idx_replay_meta_session", columnList = "session_date")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_replay_meta_symbol_session", columnNames = {"symbol", "session_date"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReplaySessionMetadataEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(name = "session_date", nullable = false)
    private LocalDate sessionDate;

    @Column(name = "candles_hash", nullable = false, length = 64)
    private String candlesHash;

    @Column(name = "analytics_version", nullable = false)
    private Integer analyticsVersion;

    @Column(name = "last_replay_at")
    private Instant lastReplayAt;

    @Column(name = "replay_duration_ms")
    private Long replayDurationMs;

    @Column(name = "signals_count")
    private Integer signalsCount;

    @Column(name = "transitions_count")
    private Integer transitionsCount;

    @Column(name = "narratives_count")
    private Integer narrativesCount;
}
