package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "trading_symbol", indexes = {
        @Index(name = "idx_trading_symbol", columnList = "symbol"),
        @Index(name = "idx_trading_symbol_enabled", columnList = "enabled"),
        @Index(name = "idx_trading_symbol_scan", columnList = "scan_enabled"),
        @Index(name = "idx_trading_symbol_group", columnList = "group_name"),
        @Index(name = "idx_trading_symbol_order", columnList = "display_order")
}, uniqueConstraints = {
        @UniqueConstraint(columnNames = "symbol")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TradingSymbol {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String symbol;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(nullable = false)
    private boolean pinned = false;

    @Column(name = "group_name", length = 64)
    private String groupName;

    @Column(name = "scan_enabled", nullable = false)
    private boolean scanEnabled = true;

    @Column(name = "preload_on_startup", nullable = false)
    private boolean preloadOnStartup = true;

    @Column(name = "subscribe_live", nullable = false)
    private boolean subscribeLive = true;

    @Column(name = "display_order", nullable = false)
    private int displayOrder = 0;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "last_viewed_at")
    private LocalDateTime lastViewedAt;

    @Column(length = 64)
    private String sector;

    @Column(name = "market_cap", precision = 20, scale = 2)
    private BigDecimal marketCap;

    @Column(length = 16)
    private String exchange;

    @Column(name = "float_shares")
    private Long floatShares;

    @Column(name = "avg_daily_volume")
    private Long avgDailyVolume;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
        if (symbol != null) {
            symbol = symbol.toUpperCase();
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
        if (symbol != null) {
            symbol = symbol.toUpperCase();
        }
    }
}
