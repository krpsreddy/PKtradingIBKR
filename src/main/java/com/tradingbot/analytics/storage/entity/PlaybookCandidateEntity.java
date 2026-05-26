package com.tradingbot.analytics.storage.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "playbook_candidates", indexes = {
        @Index(name = "idx_pb_candidate_key", columnList = "candidate_key"),
        @Index(name = "idx_pb_promotion", columnList = "promotion_state")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_pb_candidate_id", columnNames = "candidate_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaybookCandidateEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "candidate_id", nullable = false, length = 128)
    private String candidateId;

    @Column(name = "candidate_key", nullable = false, length = 512)
    private String candidateKey;

    @Column(name = "narrative_path", length = 512)
    private String narrativePath;

    @Column(name = "sequence_json", columnDefinition = "TEXT")
    private String sequence;

    private Double expectancy;
    private Double continuation;
    private Double fakeout;

    @Column(name = "quality_score")
    private Integer qualityScore;

    @Column(name = "confidence_band", length = 16)
    private String confidenceBand;

    @Column(name = "evolution_state", length = 16)
    private String evolutionState;

    @Enumerated(EnumType.STRING)
    @Column(name = "promotion_state", length = 16)
    private PromotionState promotionState;

    @Column(columnDefinition = "TEXT")
    private String stats;

    @Column(name = "payload", columnDefinition = "TEXT")
    private String payload;

    @Column(name = "analytics_version", nullable = false)
    private Integer analyticsVersion;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public enum PromotionState {
        DISCOVERED, REVIEWED, APPROVED, ACTIVE
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
