package com.tradingbot.replay;

import com.tradingbot.api.dto.ReplayScorePointDto;
import com.tradingbot.api.dto.ReplaySignalEventDto;
import com.tradingbot.models.Candle;
import com.tradingbot.signals.OpenMomentumEvaluator;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * In-memory sequential replay state. Never sees future candles beyond currentIndex.
 */
@Getter
public class ReplayContext {

    private final String symbol;
    private final LocalDate replayDate;
    private final Long avgDailyVolume;
    private final List<Candle> replayCandles = new ArrayList<>();
    private final List<ReplaySignalEventDto> replaySignals = new ArrayList<>();
    private final List<ReplayScorePointDto> scoreHistory = new ArrayList<>();
    private final List<ReplaySignalEventDto> replayTimeline = new ArrayList<>();
    private final Set<String> lifecyclePath = new LinkedHashSet<>();

    @Setter
    private int currentIndex = -1;

    private boolean openScoutFired;
    private boolean openMomFired;
    private boolean openFailFired;
    private boolean openFailBreakFired;
    private boolean openFailReadyFired;
    @Setter
    private boolean openFailPendingSetup;
    @Setter
    private java.math.BigDecimal openFailSetupBarLow;
    private boolean recoveryFailFired;
    private boolean recoveryFailReadyFired;
    @Setter
    private boolean recoveryFailPendingSetup;
    @Setter
    private java.math.BigDecimal recoveryFailSetupBarLow;
    @Setter
    private java.math.BigDecimal recoveryFailRallyPeak;
    @Setter
    private java.math.BigDecimal recoveryFailConfirmLevel;
    @Setter
    private java.math.BigDecimal recoveryFailLastReadyPeak;
    private boolean imbalanceDownFired;
    private boolean imbalanceUpFired;
    private boolean momFired;
    private boolean pullFired;
    private boolean contFired;
    @Setter
    private String openReadinessState = "";
    @Setter
    private String contReadinessState = "";
    @Setter
    private boolean momPositionActive;
    @Setter
    private boolean momBuyCycleActive;

    @Setter
    private int momEntryBarIndex = -1;

    public int barsSinceMomEntry() {
        if (momEntryBarIndex < 0 || currentIndex < 0) {
            return 0;
        }
        return currentIndex - momEntryBarIndex;
    }

    @Setter
    private java.math.BigDecimal openingRangeHigh;
    @Setter
    private java.math.BigDecimal openingRangeLow;
    @Setter
    private java.math.BigDecimal premarketHigh;
    @Setter
    private java.math.BigDecimal premarketLow;

    private boolean pullReadyActive;
    private boolean momReadyActive;
    private boolean contReadyActive;
    private boolean openReadyActive;
    private boolean openFailReadyActive;

    public ReplayContext(String symbol, LocalDate replayDate, Long avgDailyVolume) {
        this.symbol = symbol.toUpperCase();
        this.replayDate = replayDate;
        this.avgDailyVolume = avgDailyVolume;
    }

    public boolean beginReadiness(String type, boolean ready) {
        return switch (type) {
            case "OPEN_READY" -> {
                if (ready && !openReadyActive) {
                    openReadyActive = true;
                    yield true;
                }
                if (!ready) openReadyActive = false;
                yield false;
            }
            case "PULL_READY" -> {
                if (ready && !pullReadyActive) {
                    pullReadyActive = true;
                    yield true;
                }
                if (!ready) pullReadyActive = false;
                yield false;
            }
            case "MOM_READY" -> {
                if (ready && !momReadyActive) {
                    momReadyActive = true;
                    yield true;
                }
                if (!ready) momReadyActive = false;
                yield false;
            }
            case "CONT_READY" -> {
                if (ready && !contReadyActive) {
                    contReadyActive = true;
                    yield true;
                }
                if (!ready) contReadyActive = false;
                yield false;
            }
            case "OPEN_FAIL_READY" -> {
                if (ready && !openFailReadyActive) {
                    openFailReadyActive = true;
                    yield true;
                }
                if (!ready) openFailReadyActive = false;
                yield false;
            }
            default -> ready;
        };
    }

    public ReplayContext(String symbol, LocalDate replayDate) {
        this(symbol, replayDate, null);
    }

    public void appendCandle(Candle candle) {
        replayCandles.add(candle);
        currentIndex = replayCandles.size() - 1;
    }

    public void recordSignal(ReplaySignalEventDto event) {
        replayTimeline.add(event);
        replaySignals.add(event);
        lifecyclePath.add(event.getSignalType());
        if (OpenMomentumEvaluator.READINESS_OPEN_READY.equals(event.getSignalType())) {
            openReadinessState = OpenMomentumEvaluator.READINESS_OPEN_READY;
        }
    }

    public void recordScore(ReplayScorePointDto point) {
        scoreHistory.add(point);
    }

    public List<String> lifecyclePathList() {
        return new ArrayList<>(lifecyclePath);
    }

    public boolean markFiredOnce(String signalType) {
        return switch (signalType) {
            case "OPEN_SCOUT" -> { if (openScoutFired) yield false; openScoutFired = true; yield true; }
            case "OPEN_MOM_BUY" -> { if (openMomFired) yield false; openMomFired = true; yield true; }
            case "OPEN_FAIL" -> { if (openFailFired) yield false; openFailFired = true; yield true; }
            case "OPEN_FAIL_BREAK" -> { if (openFailBreakFired) yield false; openFailBreakFired = true; yield true; }
            case "OPEN_FAIL_READY" -> { if (openFailReadyFired) yield false; openFailReadyFired = true; yield true; }
            case "RECOVERY_FAIL" -> { if (recoveryFailFired) yield false; recoveryFailFired = true; yield true; }
            case "RECOVERY_FAIL_READY" -> { if (recoveryFailReadyFired) yield false; recoveryFailReadyFired = true; yield true; }
            case "IMBALANCE_DOWN" -> { if (imbalanceDownFired) yield false; imbalanceDownFired = true; yield true; }
            case "IMBALANCE_UP" -> { if (imbalanceUpFired) yield false; imbalanceUpFired = true; yield true; }
            case "MOM_BUY" -> { if (momFired) yield false; momFired = true; yield true; }
            case "PULL_BUY" -> { if (pullFired) yield false; pullFired = true; yield true; }
            case "CONT_BUY" -> { if (contFired) yield false; contFired = true; yield true; }
            default -> true;
        };
    }
}
