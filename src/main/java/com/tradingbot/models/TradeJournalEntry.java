package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "trade_journal_entries", indexes = {
        @Index(name = "idx_journal_symbol", columnList = "symbol"),
        @Index(name = "idx_journal_entry_ts", columnList = "entry_timestamp")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TradeJournalEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(name = "setup_type", length = 32)
    private String setupType;

    @Column(name = "signal_type", length = 32)
    private String signalType;

    @Column(name = "entry_timestamp")
    private LocalDateTime entryTimestamp;

    @Column(name = "entry_price", precision = 18, scale = 6)
    private BigDecimal entryPrice;

    @Column(name = "exit_price", precision = 18, scale = 6)
    private BigDecimal exitPrice;

    @Column(length = 16)
    private String result;

    @Column(name = "rr_achieved")
    private Double rrAchieved;

    @Column(name = "screenshot_path", length = 512)
    private String screenshotPath;

    @Column(name = "replay_link", length = 512)
    private String replayLink;

    @Column(length = 2048)
    private String notes;

    @Column(length = 64)
    private String emotion;

    @Column(length = 512)
    private String mistakes;

    @Column(length = 512)
    private String lessons;

    @Column(name = "trade_quality_grade", length = 8)
    private String tradeQualityGrade;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
