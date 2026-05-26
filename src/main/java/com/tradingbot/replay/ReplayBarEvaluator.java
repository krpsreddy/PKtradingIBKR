package com.tradingbot.replay;

import com.tradingbot.api.dto.ReplayScorePointDto;
import com.tradingbot.api.dto.ReplaySignalEventDto;
import com.tradingbot.candle.LiveCandleSnapshot;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.Candle;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import com.tradingbot.signals.ContinuationBuyEvaluator;
import com.tradingbot.signals.OpenFailEvaluator;
import com.tradingbot.signals.OpenMomentumEvaluator;
import com.tradingbot.signals.OpenMomentumSignalService;
import com.tradingbot.signals.OpenScoutEvaluator;
import com.tradingbot.signals.OpenScoutSignalService;
import com.tradingbot.signals.OpenFailSignalService;
import com.tradingbot.signals.MomentumPullbackEvaluator;
import com.tradingbot.signals.MomentumPullbackEvaluator.MomPullEvaluation;
import com.tradingbot.signals.RecoveryFailEvaluator;
import com.tradingbot.signals.ImbalanceBreakEvaluator;
import com.tradingbot.signals.ImbalanceBreakEvaluator.ImbalanceEvaluation;
import com.tradingbot.signals.ImbalanceSignalService;
import com.tradingbot.signals.RecoveryFailSignalService;
import com.tradingbot.signals.RecoveryFailEvaluator.RecoveryEvaluation;
import com.tradingbot.signals.SignalEngineService;
import com.tradingbot.signals.OpenMomentumEvaluator.OpenEvaluation;
import com.tradingbot.signals.OpenScoutEvaluator.ScoutEvaluation;
import com.tradingbot.signals.OpenFailEvaluator.FailEvaluation;
import com.tradingbot.signals.ContinuationBuyEvaluator.ContEvaluation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ReplayBarEvaluator {

    private static final BigDecimal EXTENDED_RSI = BigDecimal.valueOf(75);
    private static final BigDecimal EXTENDED_VWAP_DIST = BigDecimal.valueOf(0.05);
    private static final BigDecimal EXTENDED_EMA9_DIST = BigDecimal.valueOf(0.04);

    private final OpenScoutEvaluator openScoutEvaluator;
    private final OpenMomentumEvaluator openMomentumEvaluator;
    private final OpenFailEvaluator openFailEvaluator;
    private final ContinuationBuyEvaluator continuationBuyEvaluator;
    private final RecoveryFailEvaluator recoveryFailEvaluator;
    private final ImbalanceBreakEvaluator imbalanceBreakEvaluator;
    private final MomentumPullbackEvaluator momentumPullbackEvaluator;
    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;

    public void evaluateBar(ReplayContext ctx, IndicatorResult ind, Long avgDailyVol) {
        if (ind == null || !ind.isValid() || ind.getCurrentCandle() == null) {
            return;
        }

        ZonedDateTime barTime = MarketTime.toMarketZoned(ind.getCurrentCandle().getOpenTime());
        LocalDateTime ts = ind.getCurrentCandle().getOpenTime();

        updateRanges(ctx, ind.getRecentCandles());

        if (marketHoursService.isOpenScoutWindow(barTime)) {
            evaluateScout(ctx, ind, avgDailyVol, ts);
        }
        if (marketHoursService.isOpenMomentumWindow(barTime)) {
            evaluateOpenMom(ctx, ind, avgDailyVol, ts);
        }
        if (marketHoursService.isOpenFailWindow(barTime)) {
            evaluateOpenFail(ctx, ind, avgDailyVol, ts);
        }
        if (marketHoursService.isRecoveryFailWindow(barTime)) {
            evaluateRecoveryFail(ctx, ind, avgDailyVol, ts);
        }
        if (marketHoursService.isMarketOpen(barTime)) {
            evaluateImbalance(ctx, ind, ts);
            evaluateStandard(ctx, ind, ts);
        }
    }

    private void evaluateImbalance(ReplayContext ctx, IndicatorResult ind, LocalDateTime ts) {
        ImbalanceEvaluation eval = imbalanceBreakEvaluator.evaluate(ind);
        ctx.recordScore(scorePoint(ts, ImbalanceSignalService.IMBALANCE_DOWN, eval.downScore(),
                imbalanceBreakEvaluator.downLabel(eval.downScore())));

        if (eval.isImbalanceDown() && ctx.markFiredOnce(ImbalanceSignalService.IMBALANCE_DOWN)) {
            int score = eval.downScore();
            ctx.recordSignal(buildEvent(ts, ImbalanceSignalService.IMBALANCE_DOWN, "NEW", score,
                    imbalanceBreakEvaluator.downLabel(score),
                    imbalanceBreakEvaluator.buildDownChips(eval),
                    List.of(), ind, false, imbalanceBreakEvaluator.toDebugMap(eval)));
        }
        if (eval.isImbalanceUp() && !ctx.isImbalanceDownFired() && !ctx.isOpenFailFired()
                && !ctx.isOpenFailBreakFired() && !ctx.isRecoveryFailFired()
                && ctx.markFiredOnce(ImbalanceSignalService.IMBALANCE_UP)) {
            int score = eval.upScore();
            ctx.recordSignal(buildEvent(ts, ImbalanceSignalService.IMBALANCE_UP, "NEW", score,
                    imbalanceBreakEvaluator.upLabel(score),
                    imbalanceBreakEvaluator.buildUpChips(eval),
                    List.of(), ind, false, imbalanceBreakEvaluator.toDebugMap(eval)));
        }
    }

    private void evaluateScout(ReplayContext ctx, IndicatorResult ind, Long avgDailyVol, LocalDateTime ts) {
        Candle c = ind.getCurrentCandle();
        double[] fractions = {0.35, 0.55, 0.75, 1.0};
        for (double frac : fractions) {
            LiveCandleSnapshot snap = simulateIntraBarSnapshot(ctx.getSymbol(), c, frac);
            ScoutEvaluation eval = openScoutEvaluator.evaluate(
                    snap, toSymbolContext(ctx), ind.getVwap(), c.getOpen(), ind.getAvgVolume(), null);
            int score = openScoutEvaluator.calculateScore(eval);
            if (frac == 1.0) {
                ctx.recordScore(scorePoint(ts, OpenScoutSignalService.OPEN_SCOUT, score,
                        openScoutEvaluator.scoreLabel(score)));
            }

            if (eval.isScoutReadyForOpenReady() && ctx.beginReadiness(OpenMomentumEvaluator.READINESS_OPEN_READY, true)) {
                ctx.setOpenReadinessState(OpenMomentumEvaluator.READINESS_OPEN_READY);
                ctx.recordSignal(buildEvent(ts, OpenMomentumEvaluator.READINESS_OPEN_READY, "READY", score,
                        "OPEN READY", chipTrue(eval), chipFalse(eval), ind, false,
                        boolMap(openScoutEvaluator.toDebugMap(eval))));
            }
            if (eval.isOpenScout() && ctx.markFiredOnce(OpenScoutSignalService.OPEN_SCOUT)) {
                ctx.recordSignal(buildEvent(ts, OpenScoutSignalService.OPEN_SCOUT, "NEW", score,
                        "EARLY SIGNAL", chipTrue(eval), chipFalse(eval), ind, false,
                        boolMap(openScoutEvaluator.toDebugMap(eval))));
                return;
            }
        }
    }

    private LiveCandleSnapshot simulateIntraBarSnapshot(String symbol, Candle c, double fraction) {
        BigDecimal open = c.getOpen();
        BigDecimal high = c.getHigh();
        BigDecimal low = c.getLow();
        BigDecimal close = c.getClose();
        BigDecimal f = BigDecimal.valueOf(fraction);
        BigDecimal simClose = open.add(high.subtract(open).multiply(f));
        if (simClose.compareTo(close) > 0) {
            simClose = close;
        }
        BigDecimal simHigh = simClose.max(open);
        BigDecimal simLow = open.min(simClose).min(low);
        long vol = c.getVolume() != null ? c.getVolume() : 0L;
        long simVol = Math.max(1L, Math.round(vol * fraction));
        return new LiveCandleSnapshot(symbol, c.getOpenTime(), open, simHigh, simLow, simClose, simVol);
    }

    private void evaluateOpenMom(ReplayContext ctx, IndicatorResult ind, Long avgDailyVol, LocalDateTime ts) {
        OpenEvaluation eval = openMomentumEvaluator.evaluate(
                ind, toSymbolContext(ctx), avgDailyVol,
                tradingProperties.getOpenMomMinBarVolume(),
                tradingProperties.getOpenMomMinAvgDailyVolume());
        int score = openMomentumEvaluator.calculateScore(ind, eval);
        ctx.recordScore(scorePoint(ts, OpenMomentumSignalService.OPEN_MOM_BUY, score,
                openMomentumEvaluator.scoreLabel(score)));

        if (eval.isOpenReady()) {
            ctx.setOpenReadinessState(OpenMomentumEvaluator.READINESS_OPEN_READY);
            ctx.recordSignal(buildEvent(ts, OpenMomentumEvaluator.READINESS_OPEN_READY, "READY", score,
                    "OPEN READY", openMomentumEvaluator.buildReasonChips(eval), List.of(), ind, false,
                    openMomentumEvaluator.toDebugMap(eval)));
        }
        if (eval.isOpenMomBuy() && ctx.markFiredOnce(OpenMomentumSignalService.OPEN_MOM_BUY)) {
            ctx.setOpenReadinessState("");
            ctx.recordSignal(buildEvent(ts, OpenMomentumSignalService.OPEN_MOM_BUY, "NEW", score,
                    openMomentumEvaluator.scoreLabel(score), openMomentumEvaluator.buildReasonChips(eval),
                    List.of(), ind, false, openMomentumEvaluator.toDebugMap(eval)));
        }
    }

    private void evaluateOpenFail(ReplayContext ctx, IndicatorResult ind, Long avgDailyVol, LocalDateTime ts) {
        FailEvaluation eval = openFailEvaluator.evaluate(
                ind, toSymbolContext(ctx),
                ctx.isOpenScoutFired(), OpenMomentumEvaluator.READINESS_OPEN_READY.equals(ctx.getOpenReadinessState()),
                ctx.isOpenMomFired(), avgDailyVol,
                tradingProperties.getOpenMomMinBarVolume(),
                tradingProperties.getOpenMomMinAvgDailyVolume());
        int score = eval.calculateScore();
        int breakScore = eval.calculateBreakScore();
        ctx.recordScore(scorePoint(ts, OpenFailSignalService.OPEN_FAIL, score,
                openFailEvaluator.scoreLabel(score)));

        if (eval.isOpenFailBreak() && ctx.markFiredOnce(OpenFailSignalService.OPEN_FAIL_BREAK)) {
            ctx.recordSignal(buildEvent(ts, OpenFailSignalService.OPEN_FAIL_BREAK, "NEW", breakScore,
                    openFailEvaluator.breakScoreLabel(breakScore),
                    openFailEvaluator.buildBreakReasonChips(eval),
                    List.of(), ind, false, openFailEvaluator.toDebugMap(eval)));
        }

        if (ctx.isOpenFailBreakFired()) {
            if (ctx.isOpenFailPendingSetup()) {
                ctx.setOpenFailPendingSetup(false);
                ctx.setOpenFailSetupBarLow(null);
            }
            return;
        }

        if (ctx.isOpenFailPendingSetup()) {
            if (openFailEvaluator.isConfirmationBar(ind, ctx.getOpenFailSetupBarLow())) {
                if (ctx.markFiredOnce(OpenFailSignalService.OPEN_FAIL)) {
                    ctx.setOpenReadinessState("");
                    ctx.recordSignal(buildEvent(ts, OpenFailSignalService.OPEN_FAIL, "NEW", score,
                            openFailEvaluator.putSetupLabel(score), openFailEvaluator.buildReasonChips(eval),
                            List.of(), ind, false, openFailEvaluator.toDebugMap(eval)));
                }
                ctx.setOpenFailPendingSetup(false);
                ctx.setOpenFailSetupBarLow(null);
            } else if (!eval.isOpenFailSetup()) {
                ctx.setOpenFailPendingSetup(false);
                ctx.setOpenFailSetupBarLow(null);
            }
        } else if (eval.isOpenFailSetup()) {
            ctx.setOpenFailPendingSetup(true);
            ctx.setOpenFailSetupBarLow(ind.getCurrentCandle().getLow());
            if (ctx.markFiredOnce(OpenFailEvaluator.READINESS_OPEN_FAIL_READY)) {
                ctx.recordSignal(buildEvent(ts, OpenFailEvaluator.READINESS_OPEN_FAIL_READY, "READY", score,
                        "FAIL SETUP", openFailEvaluator.buildReasonChips(eval), List.of(), ind, false,
                        openFailEvaluator.toDebugMap(eval)));
            }
        }
    }

    private void evaluateRecoveryFail(ReplayContext ctx, IndicatorResult ind, Long avgDailyVol, LocalDateTime ts) {
        RecoveryEvaluation eval = recoveryFailEvaluator.evaluate(
                ind, avgDailyVol,
                tradingProperties.getOpenMomMinBarVolume(),
                tradingProperties.getOpenMomMinAvgDailyVolume());
        int score = eval.calculateScore();
        BigDecimal confirmLevel = recoveryFailEvaluator.confirmationLevel(eval);
        ctx.recordScore(scorePoint(ts, RecoveryFailSignalService.RECOVERY_FAIL, score,
                recoveryFailEvaluator.scoreLabel(score)));

        if (ctx.isRecoveryFailPendingSetup() && eval.getRallyPeak() != null
                && ctx.getRecoveryFailRallyPeak() != null
                && eval.getRallyPeak().compareTo(ctx.getRecoveryFailRallyPeak()) > 0) {
            ctx.setRecoveryFailPendingSetup(false);
            ctx.setRecoveryFailConfirmLevel(null);
            ctx.setRecoveryFailSetupBarLow(null);
        }

        if (ctx.isRecoveryFailPendingSetup()) {
            BigDecimal level = ctx.getRecoveryFailConfirmLevel() != null
                    ? ctx.getRecoveryFailConfirmLevel()
                    : confirmLevel;
            if (recoveryFailEvaluator.isConfirmationBar(ind, level)) {
                if (ctx.markFiredOnce(RecoveryFailSignalService.RECOVERY_FAIL)) {
                    ctx.recordSignal(buildEvent(ts, RecoveryFailSignalService.RECOVERY_FAIL, "NEW", score,
                            recoveryFailEvaluator.putSetupLabel(score),
                            recoveryFailEvaluator.buildReasonChips(eval),
                            List.of(), ind, false, recoveryFailEvaluator.toDebugMap(eval)));
                }
                ctx.setRecoveryFailPendingSetup(false);
                ctx.setRecoveryFailSetupBarLow(null);
                ctx.setRecoveryFailConfirmLevel(null);
                ctx.setRecoveryFailRallyPeak(null);
            } else if (eval.isRecoveryFailSetup() && confirmLevel != null) {
                ctx.setRecoveryFailConfirmLevel(confirmLevel);
            } else if (!eval.isRecoveryFailSetup()) {
                ctx.setRecoveryFailPendingSetup(false);
                ctx.setRecoveryFailSetupBarLow(null);
                ctx.setRecoveryFailConfirmLevel(null);
                ctx.setRecoveryFailRallyPeak(null);
            }
        } else if (eval.isRecoveryFailSetup()) {
            ctx.setRecoveryFailPendingSetup(true);
            ctx.setRecoveryFailRallyPeak(eval.getRallyPeak());
            ctx.setRecoveryFailSetupBarLow(ind.getCurrentCandle().getLow());
            ctx.setRecoveryFailConfirmLevel(confirmLevel);
            if (shouldEmitRecoveryReady(ctx, eval.getRallyPeak())) {
                ctx.recordSignal(buildEvent(ts, RecoveryFailEvaluator.READINESS_RECOVERY_FAIL_READY, "READY", score,
                        "RECOVERY FAIL SETUP", recoveryFailEvaluator.buildReasonChips(eval),
                        List.of(), ind, false, recoveryFailEvaluator.toDebugMap(eval)));
            }
        }
    }

    private boolean shouldEmitRecoveryReady(ReplayContext ctx, BigDecimal rallyPeak) {
        if (rallyPeak == null) {
            return false;
        }
        if (ctx.getRecoveryFailLastReadyPeak() != null
                && ctx.getRecoveryFailLastReadyPeak().compareTo(rallyPeak) >= 0) {
            return false;
        }
        ctx.setRecoveryFailLastReadyPeak(rallyPeak);
        return true;
    }

    private boolean isMomPutBiasBlocked(ReplayContext ctx) {
        return ctx.isOpenFailFired() || ctx.isOpenFailBreakFired()
                || ctx.isRecoveryFailFired() || ctx.isImbalanceDownFired();
    }

    private void evaluateStandard(ReplayContext ctx, IndicatorResult ind, LocalDateTime ts) {
        boolean contBlocked = ctx.isOpenFailFired() || ctx.isOpenFailBreakFired()
                || ctx.isRecoveryFailFired() || ctx.isImbalanceDownFired();
        ContEvaluation cont = continuationBuyEvaluator.evaluate(ind, contBlocked);
        if (cont.isContReady() && ctx.beginReadiness(ContinuationBuyEvaluator.READINESS_CONT_READY, true)) {
            ctx.setContReadinessState(ContinuationBuyEvaluator.READINESS_CONT_READY);
            int score = continuationBuyEvaluator.calculateConfidence(ind, cont);
            ctx.recordSignal(buildEvent(ts, ContinuationBuyEvaluator.READINESS_CONT_READY, "READY", score,
                    "CONT READY", continuationBuyEvaluator.buildReasonChips(ind, cont), List.of(), ind, false,
                    contDebug(cont)));
        } else if (!cont.isContReady()) {
            ctx.beginReadiness(ContinuationBuyEvaluator.READINESS_CONT_READY, false);
        }
        if (cont.isContBuy() && ctx.markFiredOnce(SignalEngineService.CONT_BUY)) {
            int score = continuationBuyEvaluator.calculateConfidence(ind, cont);
            ctx.recordSignal(buildEvent(ts, SignalEngineService.CONT_BUY, "NEW", score,
                    continuationBuyEvaluator.confidenceLabel(score),
                    continuationBuyEvaluator.buildReasonChips(ind, cont), List.of(), ind, false, contDebug(cont)));
            ctx.setContReadinessState("");
        }

        MomPullEvaluation mp = momentumPullbackEvaluator.evaluate(ind);
        if (mp.isPullReady() && ctx.beginReadiness(MomentumPullbackEvaluator.READINESS_PULL_READY, true)) {
            ctx.recordSignal(buildEvent(ts, MomentumPullbackEvaluator.READINESS_PULL_READY, "READY",
                    mp.getPullConfidence(), "PULL READY",
                    momentumPullbackEvaluator.buildPullReasonChips(mp),
                    momentumPullbackEvaluator.buildFailedConditions(mp, true), ind, false,
                    momentumPullbackEvaluator.toPullDebugMap(mp)));
        } else if (!mp.isPullReady()) {
            ctx.beginReadiness(MomentumPullbackEvaluator.READINESS_PULL_READY, false);
        }
        if (mp.isPullBuy() && ctx.markFiredOnce(SignalEngineService.PULL_BUY)) {
            ctx.recordSignal(buildEvent(ts, SignalEngineService.PULL_BUY, "NEW", mp.getPullConfidence(),
                    momentumPullbackEvaluator.confidenceLabel(mp.getPullConfidence()),
                    momentumPullbackEvaluator.buildPullReasonChips(mp),
                    momentumPullbackEvaluator.buildFailedConditions(mp, true), ind, isExtended(ind),
                    momentumPullbackEvaluator.toPullDebugMap(mp)));
        }
        if (mp.isMomReady() && ctx.beginReadiness(MomentumPullbackEvaluator.READINESS_MOM_READY, true)) {
            ctx.recordSignal(buildEvent(ts, MomentumPullbackEvaluator.READINESS_MOM_READY, "READY",
                    mp.getMomConfidence(), "MOM READY",
                    momentumPullbackEvaluator.buildMomReasonChips(mp),
                    momentumPullbackEvaluator.buildFailedConditions(mp, false), ind, false,
                    momentumPullbackEvaluator.toMomDebugMap(mp)));
        } else if (!mp.isMomReady()) {
            ctx.beginReadiness(MomentumPullbackEvaluator.READINESS_MOM_READY, false);
        }
        if (mp.isMomBuy() && !ctx.isMomBuyCycleActive() && !isMomPutBiasBlocked(ctx)) {
            if (ctx.markFiredOnce(SignalEngineService.MOM_BUY)) {
                ctx.recordSignal(buildEvent(ts, SignalEngineService.MOM_BUY, "NEW", mp.getMomConfidence(),
                        momentumPullbackEvaluator.confidenceLabel(mp.getMomConfidence()),
                        momentumPullbackEvaluator.buildMomReasonChips(mp),
                        momentumPullbackEvaluator.buildFailedConditions(mp, false), ind, isExtended(ind),
                        momentumPullbackEvaluator.toMomDebugMap(mp)));
                ctx.setMomBuyCycleActive(true);
                ctx.setMomPositionActive(true);
                ctx.setMomEntryBarIndex(ctx.getCurrentIndex());
            }
        }
        if (ctx.isMomPositionActive()
                && momentumPullbackEvaluator.shouldExit(ind, ctx.barsSinceMomEntry())) {
            ctx.recordSignal(buildEvent(ts, SignalEngineService.EXIT, "EXITED", 0, "EXIT",
                    momentumPullbackEvaluator.buildExitReasons(ind), List.of(), ind, false, Map.of()));
            ctx.setMomPositionActive(false);
            ctx.setMomBuyCycleActive(false);
            ctx.setMomEntryBarIndex(-1);
        }
    }

    private void updateRanges(ReplayContext ctx, List<Candle> visible) {
        if (visible == null) return;
        List<Candle> session = visible.stream()
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .filter(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(ctx.getReplayDate()))
                .sorted(java.util.Comparator.comparing(Candle::getOpenTime))
                .toList();
        if (!session.isEmpty()) {
            Candle first = session.get(0);
            ctx.setOpeningRangeHigh(first.getHigh());
            ctx.setOpeningRangeLow(first.getLow());
        }
        BigDecimal pmHigh = null;
        BigDecimal pmLow = null;
        for (Candle c : visible) {
            var z = MarketTime.toMarketZoned(c.getOpenTime());
            if (!z.toLocalDate().equals(ctx.getReplayDate())) continue;
            if (z.toLocalTime().isBefore(java.time.LocalTime.of(9, 30)) && !z.toLocalTime().isBefore(java.time.LocalTime.of(4, 0))) {
                pmHigh = pmHigh == null ? c.getHigh() : pmHigh.max(c.getHigh());
                pmLow = pmLow == null ? c.getLow() : pmLow.min(c.getLow());
            }
        }
        ctx.setPremarketHigh(pmHigh);
        ctx.setPremarketLow(pmLow);
    }

    private com.tradingbot.symbol.SymbolContext toSymbolContext(ReplayContext ctx) {
        com.tradingbot.symbol.SymbolContext sc = new com.tradingbot.symbol.SymbolContext(ctx.getSymbol());
        sc.setOpeningRangeHigh(ctx.getOpeningRangeHigh());
        sc.setOpeningRangeLow(ctx.getOpeningRangeLow());
        sc.setPremarketHigh(ctx.getPremarketHigh());
        sc.setPremarketLow(ctx.getPremarketLow());
        sc.setOpenReadinessState(ctx.getOpenReadinessState());
        sc.setOpenScoutFired(ctx.isOpenScoutFired());
        sc.setOpenScoutActive(ctx.isOpenScoutFired());
        if (ctx.getAvgDailyVolume() != null) {
            sc.setAvgDailyVolume(ctx.getAvgDailyVolume());
        }
        return sc;
    }

    private ReplaySignalEventDto buildEvent(LocalDateTime ts, String type, String lifecycle, int score,
                                            String label, List<String> passed, List<String> failed,
                                            IndicatorResult ind, boolean extended, Map<String, Boolean> conditions) {
        return ReplaySignalEventDto.builder()
                .timestamp(MarketTime.formatIso(ts))
                .signalType(type)
                .lifecycleState(lifecycle)
                .score(score)
                .setupLabel(label)
                .passedConditions(passed)
                .failedConditions(failed)
                .price(ind.getClose().doubleValue())
                .rvol(ind.getRelativeVolume() != null ? ind.getRelativeVolume().doubleValue() : null)
                .vwap(ind.getVwap().doubleValue())
                .vwapState(ind.getClose().compareTo(ind.getVwap()) > 0 ? "ABOVE" : "BELOW")
                .trend(trendLabel(ind))
                .extended(extended)
                .conditions(conditions)
                .build();
    }

    private ReplayScorePointDto scorePoint(LocalDateTime ts, String engine, int score, String label) {
        return ReplayScorePointDto.builder()
                .timestamp(MarketTime.formatIso(ts))
                .engine(engine)
                .score(score)
                .scoreLabel(label)
                .build();
    }

    private String trendLabel(IndicatorResult ind) {
        if (ind.getEma9().compareTo(ind.getEma20()) > 0 && ind.getEma20().compareTo(ind.getEma50()) > 0) {
            return "bullish";
        }
        if (ind.getEma9().compareTo(ind.getEma20()) < 0) {
            return "bearish";
        }
        return "neutral";
    }

    private boolean isExtended(IndicatorResult ind) {
        if (ind.getRsi().compareTo(EXTENDED_RSI) > 0) return true;
        if (ind.getVwap().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal d = ind.getClose().subtract(ind.getVwap()).abs()
                    .divide(ind.getVwap(), 4, RoundingMode.HALF_UP);
            if (d.compareTo(EXTENDED_VWAP_DIST) > 0) return true;
        }
        if (ind.getEma9().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal d = ind.getClose().subtract(ind.getEma9()).abs()
                    .divide(ind.getEma9(), 4, RoundingMode.HALF_UP);
            if (d.compareTo(EXTENDED_EMA9_DIST) > 0) return true;
        }
        return false;
    }

    private List<String> extendedReasons(IndicatorResult ind) {
        List<String> r = new ArrayList<>();
        if (ind.getRsi().compareTo(EXTENDED_RSI) > 0) r.add("RSI > 75");
        if (ind.getVwap().compareTo(BigDecimal.ZERO) > 0
                && ind.getClose().subtract(ind.getVwap()).abs().divide(ind.getVwap(), 4, RoundingMode.HALF_UP)
                .compareTo(EXTENDED_VWAP_DIST) > 0) {
            r.add("Far from VWAP");
        }
        return r;
    }

    private List<String> chipTrue(ScoutEvaluation eval) {
        return openScoutEvaluator.buildReasonChips(eval);
    }

    private List<String> chipFalse(ScoutEvaluation eval) {
        Map<String, Object> map = openScoutEvaluator.toDebugMap(eval);
        return map.entrySet().stream()
                .filter(e -> e.getValue() instanceof Boolean b && !b)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    private Map<String, Boolean> boolMap(Map<String, Object> map) {
        Map<String, Boolean> out = new LinkedHashMap<>();
        map.forEach((k, v) -> { if (v instanceof Boolean b) out.put(k, b); });
        return out;
    }

    private Map<String, Boolean> contDebug(ContEvaluation cont) {
        Map<String, Boolean> m = new LinkedHashMap<>();
        m.put("bullishTrend", cont.isBullishTrend());
        m.put("strongEarlierMove", cont.isStrongEarlierMove());
        m.put("tightConsolidation", cont.isTightConsolidation());
        m.put("aboveVwap", cont.isAboveVwap());
        m.put("breakoutTrigger", cont.isBreakoutTrigger());
        m.put("contBuy", cont.isContBuy());
        return m;
    }
}
