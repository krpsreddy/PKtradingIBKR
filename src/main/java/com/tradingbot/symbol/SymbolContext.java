package com.tradingbot.symbol;

import com.tradingbot.api.dto.CandleChartDto;
import com.tradingbot.api.dto.IndicatorDto;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@Getter
@Setter
public class SymbolContext {

    private final String symbol;
    private volatile boolean historicalLoaded;
    private volatile boolean liveSubscribed;
    private volatile boolean loadingHistorical;
    private volatile String trend = "neutral";
    private volatile Double lastPrice;
    private volatile Double relativeVolume;
    private volatile String signalState = "NONE";
    private volatile String lifecycleState = "NONE";
    private volatile String readinessState = "";
    private volatile String openReadinessState = "";
    private volatile java.math.BigDecimal openingRangeHigh;
    private volatile java.math.BigDecimal openingRangeLow;
    private volatile java.time.LocalDate openingRangeSessionDate;
    private volatile Double gapPercent;
    private volatile java.math.BigDecimal premarketHigh;
    private volatile java.math.BigDecimal premarketLow;
    private volatile java.time.LocalDate premarketSessionDate;
    private volatile java.math.BigDecimal sessionOpenPrice;
    private volatile java.math.BigDecimal liveVwap;
    private volatile Double liveEstimatedRvol;
    private volatile Double liveBodyStrength;
    private volatile Long avgDailyVolume;
    private volatile boolean openScoutFired;
    private volatile boolean openScoutActive;
    private volatile boolean openScoutFailed;
    private volatile boolean openFailPendingSetup;
    private volatile java.math.BigDecimal openFailSetupBarLow;
    private volatile java.math.BigDecimal recoveryFailSetupBarLow;
    private volatile boolean recoveryFailPendingSetup;
    private volatile java.math.BigDecimal recoveryFailRallyPeak;
    private volatile java.math.BigDecimal recoveryFailConfirmLevel;
    private volatile java.math.BigDecimal recoveryFailLastReadyPeak;
    private volatile java.time.LocalDate openScoutSessionDate;
    private volatile long lastScoutEvalMs;
    private volatile Instant lastUpdate;
    private volatile Instant lastAccessedAt;
    private volatile IndicatorDto latestIndicators;

    private final List<CandleChartDto> cachedCandles = new ArrayList<>();
    private final AtomicBoolean cacheValid = new AtomicBoolean(false);

    public SymbolContext(String symbol) {
        this.symbol = symbol.toUpperCase();
    }

    public void invalidateCache() {
        cacheValid.set(false);
        cachedCandles.clear();
    }

    public void updateCache(List<CandleChartDto> candles) {
        cachedCandles.clear();
        cachedCandles.addAll(candles);
        cacheValid.set(true);
        lastUpdate = Instant.now();
    }

    public boolean hasValidCache() {
        return cacheValid.get() && !cachedCandles.isEmpty();
    }
}
