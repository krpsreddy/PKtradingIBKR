package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "signal_outcomes", indexes = {
        @Index(name = "idx_outcome_symbol", columnList = "symbol"),
        @Index(name = "idx_outcome_session", columnList = "session_date"),
        @Index(name = "idx_outcome_setup", columnList = "setup_type"),
        @Index(name = "idx_outcome_setup_session", columnList = "setup_type, session_date"),
        @Index(name = "idx_outcome_symbol_session", columnList = "symbol, session_date"),
        @Index(name = "idx_outcome_regime", columnList = "regime")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SignalOutcome {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(name = "signal_type", length = 32)
    private String signalType;

    @Column(name = "setup_type", length = 32)
    private String setupType;

    @Column(name = "entry_quality", length = 16)
    private String entryQuality;

    @Column(length = 32)
    private String regime;

    @Column(name = "signal_health", length = 32)
    private String signalHealth;

    @Column(length = 16)
    private String outcome;

    @Column(name = "rr_achieved")
    private Double rrAchieved;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(length = 32)
    private String sector;

    @Column(name = "time_of_day", length = 16)
    private String timeOfDay;

    @Column(name = "rank_at_entry")
    private Integer rankAtEntry;

    @Column(name = "trade_quality_grade", length = 8)
    private String tradeQualityGrade;

    @Column(name = "entry_price", precision = 18, scale = 6)
    private BigDecimal entryPrice;

    @Column(name = "exit_price", precision = 18, scale = 6)
    private BigDecimal exitPrice;

    /** Max favorable excursion as fraction of entry (e.g. 0.038 = 3.8%). */
    @Column(name = "max_favorable_excursion")
    private Double maxFavorableExcursion;

    /** Max adverse excursion as fraction of entry. */
    @Column(name = "max_adverse_excursion")
    private Double maxAdverseExcursion;

    /** Continuation move achieved as fraction. */
    @Column(name = "continuation_distance")
    private Double continuationDistance;

    /** Distance to failure/invalidation as fraction. */
    @Column(name = "failure_distance")
    private Double failureDistance;

    /** Extension from VWAP/EMA at peak as fraction. */
    @Column(name = "extension_distance")
    private Double extensionDistance;

    @Column(name = "follow_through")
    private Boolean followThrough;

    @Column(name = "session_date", nullable = false)
    private LocalDate sessionDate;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;

    @PrePersist
    void onCreate() {
        if (recordedAt == null) recordedAt = LocalDateTime.now();
        if (sessionDate == null) sessionDate = recordedAt.toLocalDate();
    }
}
