package com.tradingbot.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@Data
@ConfigurationProperties(prefix = "trading")
public class TradingProperties {
    private String timeframe = "5MIN";
    private int candleMinutes = 5;
    /** Max 5m bars persisted per symbol (~60 trading days ≈ 4700 bars). */
    private int candleHistorySize = 5000;
    /** Days of 5m history loaded for live intelligence. */
    private int historicalLookbackDays = 60;
    /** IBKR historical request duration (e.g. "60 D"). */
    private String ibkrHistoricalDuration = "60 D";
    /** Purge candles older than this many calendar days. */
    private int candleRetentionDays = 90;
    /** Default outcome/statistics lookback window. */
    private int intelligenceLookbackDays = 60;
    private int minCandlesForSignals = 50;
    private int avgVolumePeriod = 20;
    private int signalDedupeMinutes = 15;
    private int activeSignalMinutes = 5;
    private int symbolIdleEvictMinutes = 30;
    private long evictionCheckMs = 300000L;
    private List<String> watchlist = List.of();
    private List<String> marketTrendSymbols = List.of("SPY", "QQQ");
    private long openMomMinBarVolume = 100_000L;
    private long openMomMinAvgDailyVolume = 500_000L;
    private long openScoutEvalIntervalMs = 3000L;
    private long openScoutMinLiveVolume = 50_000L;
    private int momPullMinConfidence = 4;
    private int momPullMiddayMinConfidence = 5;
    private int momPullLateDayMinConfidence = 5;
    private int momPullMinHoldBars = 2;
    private int momPullExitMinSignals = 2;
    private double momPullPriorImpulsePct = 0.015;
    private double momPullChopRangePct = 0.008;
    private double momPullMinRvolPull = 1.3;
    private double momPullMinRvolMom = 1.5;
    private int momPullImpulseLookbackBars = 6;
    private int momPullMomImpulseLookbackBars = 12;
    private double momPullMomImpulseMinBodyPct = 0.008;
    private int replayMinCandles = 20;
    private String openFailBreakEnd = "10:15";
    private double contBreakoutMinRvol = 1.5;
    private double recoveryFailMinRallyPct = 0.03;
    private double recoveryFailMaxRallyPct = 0.10;
    private double recoveryFailMinDrawdownPct = 0.02;
    private double recoveryFailMinRvol = 1.3;
    private double recoveryFailSessionLowBuffer = 0.01;
    private int recoveryFailBearishBars = 3;
    private int recoveryFailRallyLookbackBars = 12;
    private int recoveryFailPeakMaxAgeBars = 6;
    private String recoveryFailWindowEnd = "15:00";
    private double openFailSelloffMinBodyPct = 0.55;
    private double openFailMaxLowerWickPct = 0.40;
    private double imbalanceMinGapPct = 0.002;
    private double imbalanceImpulseMinBodyPct = 0.55;
    private double imbalanceMaxWickPct = 0.35;
    private double imbalanceMinImpulseRangePct = 0.008;
    private double imbalanceMinRvol = 1.0;
    private double extendedMaxEma9DistPct = 0.04;
    private double extendedMaxVwapDistPct = 0.05;
    private double extendedVerticalMovePct = 0.06;
    private int extendedVerticalLookbackBars = 20;
    private double regimeChopRangePct = 0.008;
}
