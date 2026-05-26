package com.tradingbot.signals;

import com.tradingbot.alerts.TelegramAlertService;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.models.TradingSymbol;
import com.tradingbot.repository.TradingSignalRepository;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import com.tradingbot.services.TradingSymbolService;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class OpenFailSignalService {

    public static final String OPEN_FAIL = SignalType.OPEN_FAIL.code();
    public static final String OPEN_FAIL_BREAK = SignalType.OPEN_FAIL_BREAK.code();

    private final OpenFailEvaluator openFailEvaluator;
    private final OpeningRangeService openingRangeService;
    private final PremarketTrackerService premarketTrackerService;
    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;
    private final TradingSignalRepository tradingSignalRepository;
    private final SignalLifecycleService signalLifecycleService;
    private final TelegramAlertService telegramAlertService;
    private final SymbolContextRegistry symbolContextRegistry;
    private final TradingSymbolService tradingSymbolService;
    private final MarketReplayRecorderService replayRecorder;

    public void evaluateOpenFail(String symbol, IndicatorResult indicators) {
        if (indicators == null || !indicators.isValid()) {
            return;
        }
        if (!marketHoursService.isOpenFailWindow()) {
            return;
        }

        openingRangeService.updateOpeningRange(symbol, indicators.getRecentCandles());
        premarketTrackerService.updateFromCandles(symbol, indicators.getRecentCandles());

        SymbolContext ctx = symbolContextRegistry.getOrCreate(symbol);
        OpenFailEvaluator.FailEvaluation eval = evaluateContext(symbol, indicators, ctx);

        int score = eval.calculateScore();
        int breakScore = eval.calculateBreakScore();
        boolean aboveVwap = indicators.getClose().compareTo(indicators.getVwap()) > 0;

        replayRecorder.recordFromEval(
                symbol, OPEN_FAIL, score, openFailEvaluator.toDebugMap(eval),
                indicators.getClose(),
                indicators.getVolume(),
                indicators.getRelativeVolume(),
                aboveVwap);

        if (eval.isOpenFailBreak() && !isDuplicate(symbol, OPEN_FAIL_BREAK)) {
            persistBreak(symbol, indicators, eval, breakScore);
        }

        if (isOpenFailBlockedAfterBreak(symbol, ctx)) {
            clearOpenFailPending(ctx);
            return;
        }

        if (ctx.isOpenFailPendingSetup()) {
            if (openFailEvaluator.isConfirmationBar(indicators, ctx.getOpenFailSetupBarLow())) {
                if (!isDuplicate(symbol, OPEN_FAIL)) {
                    List<String> reasons = openFailEvaluator.buildReasonChips(eval);
                    String label = openFailEvaluator.scoreLabel(score);
                    String putLabel = openFailEvaluator.putSetupLabel(score);
                    persistAndAlert(symbol, indicators, reasons, score, label, putLabel, eval);
                    clearOpenMomentumState(ctx);
                }
                clearOpenFailPending(ctx);
            } else if (!eval.isOpenFailSetup()) {
                clearOpenFailPending(ctx);
            }
        } else if (eval.isOpenFailSetup()) {
            ctx.setOpenFailPendingSetup(true);
            ctx.setOpenFailSetupBarLow(indicators.getCurrentCandle().getLow());
            symbolContextRegistry.updateOpenReadinessState(symbol, OpenFailEvaluator.READINESS_OPEN_FAIL_READY);
        } else if (!ctx.isOpenFailPendingSetup()) {
            symbolContextRegistry.updateOpenReadinessState(symbol, "");
        }
    }

    public OpenFailEvaluator.FailEvaluation evaluateForDebug(String symbol, IndicatorResult indicators) {
        openingRangeService.updateOpeningRange(symbol, indicators.getRecentCandles());
        premarketTrackerService.updateFromCandles(symbol, indicators.getRecentCandles());
        SymbolContext ctx = symbolContextRegistry.getOrCreate(symbol);
        return evaluateContext(symbol, indicators, ctx);
    }

    private OpenFailEvaluator.FailEvaluation evaluateContext(String symbol, IndicatorResult indicators,
                                                               SymbolContext ctx) {
        TradingSymbol row = tradingSymbolService.findActive(symbol).orElse(null);
        Long avgDailyVol = row != null ? row.getAvgDailyVolume() : null;
        boolean hadScout = hadSignalToday(symbol, SignalType.OPEN_SCOUT.code()) || ctx.isOpenScoutFired();
        boolean hadReady = OpenMomentumEvaluator.READINESS_OPEN_READY.equals(ctx.getOpenReadinessState())
                || hadSignalToday(symbol, OpenMomentumEvaluator.READINESS_OPEN_READY);
        boolean hadOpenMom = hadSignalToday(symbol, OpenMomentumSignalService.OPEN_MOM_BUY)
                || OpenMomentumSignalService.OPEN_MOM_BUY.equals(ctx.getSignalState());
        return openFailEvaluator.evaluate(
                indicators, ctx, hadScout, hadReady, hadOpenMom, avgDailyVol,
                tradingProperties.getOpenMomMinBarVolume(),
                tradingProperties.getOpenMomMinAvgDailyVolume());
    }

    private boolean isOpenFailBlockedAfterBreak(String symbol, SymbolContext ctx) {
        if (OPEN_FAIL_BREAK.equals(ctx.getSignalState())) {
            return true;
        }
        return hadSignalToday(symbol, OPEN_FAIL_BREAK);
    }

    private void clearOpenFailPending(SymbolContext ctx) {
        ctx.setOpenFailPendingSetup(false);
        ctx.setOpenFailSetupBarLow(null);
        symbolContextRegistry.updateOpenReadinessState(ctx.getSymbol(), "");
    }

    private void persistBreak(String symbol, IndicatorResult i, OpenFailEvaluator.FailEvaluation eval, int score) {
        List<String> reasons = openFailEvaluator.buildBreakReasonChips(eval);
        String label = openFailEvaluator.breakScoreLabel(score);
        String reasonSummary = String.join(" + ", reasons) + " (" + label + " " + score + "/7)";

        TradingSignal signal = TradingSignal.builder()
                .symbol(symbol)
                .signalType(OPEN_FAIL_BREAK)
                .price(i.getClose())
                .rsi(i.getRsi())
                .macd(i.getMacd())
                .vwap(i.getVwap())
                .confidenceScore(score)
                .signalReason(reasonSummary)
                .signalReasons(String.join("|", reasons))
                .relativeVolume(i.getRelativeVolume())
                .timestamp(MarketTime.nowLocal())
                .build();

        signalLifecycleService.onSignalCreated(signal);
        tradingSignalRepository.save(signal);
        log.info("Signal generated: OPEN_FAIL_BREAK {} at price={} score={} — {}",
                symbol, signal.getPrice(), score, reasonSummary);

        replayRecorder.record(
                symbol, OPEN_FAIL_BREAK, SignalLifecycleState.NEW, score,
                openFailEvaluator.toDebugMap(eval), i.getClose(), i.getVolume(),
                i.getRelativeVolume(), "BELOW");

        telegramAlertService.sendOpenFailBreakAlert(symbol, signal.getPrice(), reasons, label);
        symbolContextRegistry.updateSignalState(symbol, OPEN_FAIL_BREAK, SignalLifecycleState.NEW);
    }

    private void persistAndAlert(String symbol, IndicatorResult i, List<String> reasons,
                                 int score, String label, String putLabel,
                                 OpenFailEvaluator.FailEvaluation eval) {
        String reasonsJoined = String.join("|", reasons);
        String reasonSummary = String.join(" + ", reasons) + " (" + label + " " + score + "/7)";
        if (!putLabel.isBlank()) {
            reasonSummary += " [" + putLabel + "]";
        }

        TradingSignal signal = TradingSignal.builder()
                .symbol(symbol)
                .signalType(OPEN_FAIL)
                .price(i.getClose())
                .rsi(i.getRsi())
                .macd(i.getMacd())
                .vwap(i.getVwap())
                .confidenceScore(score)
                .signalReason(reasonSummary)
                .signalReasons(reasonsJoined)
                .relativeVolume(i.getRelativeVolume())
                .timestamp(MarketTime.nowLocal())
                .build();

        signalLifecycleService.onSignalCreated(signal);
        tradingSignalRepository.save(signal);
        log.info("Signal generated: OPEN_FAIL {} at price={} score={} — {}",
                symbol, signal.getPrice(), score, reasonSummary);

        replayRecorder.record(
                symbol, OPEN_FAIL, SignalLifecycleState.NEW, score,
                openFailEvaluator.toDebugMap(eval), i.getClose(), i.getVolume(),
                i.getRelativeVolume(), "BELOW");

        telegramAlertService.sendOpenFailAlert(symbol, signal.getPrice(), reasons, putLabel);
        symbolContextRegistry.updateSignalState(symbol, OPEN_FAIL, SignalLifecycleState.NEW);
    }

    private void clearOpenMomentumState(SymbolContext ctx) {
        ctx.setOpenScoutActive(false);
        symbolContextRegistry.updateOpenReadinessState(ctx.getSymbol(), "");
    }

    private boolean hadSignalToday(String symbol, String signalType) {
        LocalDateTime since = MarketTime.now().toLocalDate().atStartOfDay();
        return tradingSignalRepository.findBySymbolAndTimestampAfterOrderByTimestampDesc(symbol, since)
                .stream()
                .anyMatch(s -> signalType.equals(s.getSignalType()));
    }

    private boolean isDuplicate(String symbol, String signalType) {
        LocalDate today = MarketTime.now().toLocalDate();
        LocalDateTime since = today.atStartOfDay();
        return tradingSignalRepository.findBySymbolAndTimestampAfterOrderByTimestampDesc(symbol, since)
                .stream()
                .anyMatch(s -> signalType.equals(s.getSignalType()));
    }
}
