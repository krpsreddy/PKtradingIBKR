package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "trading_signals")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TradingSignal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String symbol;

    @Column(name = "signal_type", nullable = false)
    private String signalType;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal price;

    @Column(precision = 18, scale = 6)
    private BigDecimal rsi;

    @Column(precision = 18, scale = 6)
    private BigDecimal macd;

    @Column(precision = 18, scale = 6)
    private BigDecimal vwap;

    @Column(name = "confidence_score")
    private Integer confidenceScore;

    @Column(name = "signal_reason", length = 512)
    private String signalReason;

    @Column(name = "signal_reasons", length = 512)
    private String signalReasons;

    @Column(name = "lifecycle_state", length = 32)
    private String lifecycleState;

    @Column(name = "last_updated")
    private LocalDateTime lastUpdated;

    @Column(name = "invalidation_reason", length = 256)
    private String invalidationReason;

    @Column(name = "relative_volume", precision = 18, scale = 4)
    private BigDecimal relativeVolume;

    @Column(nullable = false)
    private LocalDateTime timestamp;
}
