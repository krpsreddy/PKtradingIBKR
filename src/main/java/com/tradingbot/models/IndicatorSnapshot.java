package com.tradingbot.models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "indicator_snapshots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IndicatorSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String symbol;

    @Column(precision = 18, scale = 6)
    private BigDecimal ema9;

    @Column(precision = 18, scale = 6)
    private BigDecimal ema20;

    @Column(precision = 18, scale = 6)
    private BigDecimal ema50;

    @Column(precision = 18, scale = 6)
    private BigDecimal rsi;

    @Column(precision = 18, scale = 6)
    private BigDecimal macd;

    @Column(name = "signal_line", precision = 18, scale = 6)
    private BigDecimal signalLine;

    @Column(precision = 18, scale = 6)
    private BigDecimal vwap;

    @Column(name = "avg_volume")
    private Long avgVolume;

    @Column(name = "relative_volume", precision = 18, scale = 4)
    private BigDecimal relativeVolume;

    @Column(nullable = false)
    private LocalDateTime timestamp;
}
