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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecoveryFailSignalService {

    public static final String RECOVERY_FAIL = SignalType.RECOVERY_FAIL.code();

    private final RecoveryFailEvaluator recoveryFailEvaluator;
    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;
    private final TradingSignalRepository tradingSignalRepository;
    private final SignalLifecycleService signalLifecycleService;
    private final TelegramAlertService telegramAlertService;
    private final SymbolContextRegistry symbolContextRegistry;
    private final TradingSymbolService tradingSymbolService;
    private final MarketReplayRecorderService replayRecorder;

    public void evaluateRecoveryFail(String symbol, IndicatorResult indicators) {
        if (indicators == null || !indicators.isValid()) {
            return;
        }
        if (!marketHoursService.isRecoveryFailWindow()) {
            return;
        }

        SymbolContext ctx = symbolContextRegistry.getOrCreate(symbol);
        RecoveryFailEvaluator.RecoveryEvaluation eval = evaluateContext(symbol, indicators);
        int score = eval.calculateScore();
        BigDecimal confirmLevel = recoveryFailEvaluator.confirmationLevel(eval);
        boolean aboveVwap = indicators.getClose().compareTo(indicators.getVwap()) > 0;

        replayRecorder.recordFromEval(
                symbol, RECOVERY_FAIL, score, recoveryFailEvaluator.toDebugMap(eval),
                indicators.getClose(),
                indicators.getVolume(),
                indicators.getRelativeVolume(),
                aboveVwap);

        if (ctx.isRecoveryFailPendingSetup() && eval.getRallyPeak() != null
                && ctx.getRecoveryFailRallyPeak() != null
                && eval.getRallyPeak().compareTo(ctx.getRecoveryFailRallyPeak()) > 0) {
            clearPending(ctx);
            symbolContextRegistry.updateReadinessState(symbol, "");
        }

        if (ctx.isRecoveryFailPendingSetup()) {
            BigDecimal level = ctx.getRecoveryFailConfirmLevel() != null
                    ? ctx.getRecoveryFailConfirmLevel()
                    : confirmLevel;
            if (recoveryFailEvaluator.isConfirmationBar(indicators, level)) {
                if (!isDuplicate(symbol)) {
                    List<String> reasons = recoveryFailEvaluator.buildReasonChips(eval);
                    String label = recoveryFailEvaluator.scoreLabel(score);
                    String putLabel = recoveryFailEvaluator.putSetupLabel(score);
                    persistAndAlert(symbol, indicators, reasons, score, label, putLabel, eval);
                }
                clearPending(ctx);
                symbolContextRegistry.updateReadinessState(symbol, "");
            } else if (eval.isRecoveryFailSetup() && confirmLevel != null) {
                ctx.setRecoveryFailConfirmLevel(confirmLevel);
            } else if (!eval.isRecoveryFailSetup()) {
                clearPending(ctx);
                symbolContextRegistry.updateReadinessState(symbol, "");
            }
        } else if (eval.isRecoveryFailSetup()) {
            ctx.setRecoveryFailPendingSetup(true);
            ctx.setRecoveryFailRallyPeak(eval.getRallyPeak());
            ctx.setRecoveryFailSetupBarLow(indicators.getCurrentCandle().getLow());
            ctx.setRecoveryFailConfirmLevel(confirmLevel);
            if (shouldEmitRecoveryReady(ctx, eval.getRallyPeak())) {
                symbolContextRegistry.updateReadinessState(symbol, RecoveryFailEvaluator.READINESS_RECOVERY_FAIL_READY);
            }
        } else if (!ctx.isRecoveryFailPendingSetup()) {
            symbolContextRegistry.updateReadinessState(symbol, "");
        }
    }

    public RecoveryFailEvaluator.RecoveryEvaluation evaluateForDebug(String symbol, IndicatorResult indicators) {
        return evaluateContext(symbol, indicators);
    }

    private RecoveryFailEvaluator.RecoveryEvaluation evaluateContext(String symbol, IndicatorResult indicators) {
        TradingSymbol row = tradingSymbolService.findActive(symbol).orElse(null);
        Long avgDailyVol = row != null ? row.getAvgDailyVolume() : null;
        return recoveryFailEvaluator.evaluate(
                indicators, avgDailyVol,
                tradingProperties.getOpenMomMinBarVolume(),
                tradingProperties.getOpenMomMinAvgDailyVolume());
    }

    private boolean shouldEmitRecoveryReady(SymbolContext ctx, BigDecimal rallyPeak) {
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

    private void clearPending(SymbolContext ctx) {
        ctx.setRecoveryFailPendingSetup(false);
        ctx.setRecoveryFailSetupBarLow(null);
        ctx.setRecoveryFailConfirmLevel(null);
        ctx.setRecoveryFailRallyPeak(null);
    }

    private void persistAndAlert(String symbol, IndicatorResult i, List<String> reasons,
                                 int score, String label, String putLabel,
                                 RecoveryFailEvaluator.RecoveryEvaluation eval) {
        String reasonsJoined = String.join("|", reasons);
        String reasonSummary = String.join(" + ", reasons) + " (" + label + " " + score + "/7)";
        if (!putLabel.isBlank()) {
            reasonSummary += " [" + putLabel + "]";
        }

        TradingSignal signal = TradingSignal.builder()
                .symbol(symbol)
                .signalType(RECOVERY_FAIL)
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
        log.info("Signal generated: RECOVERY_FAIL {} at price={} score={} — {}",
                symbol, signal.getPrice(), score, reasonSummary);

        replayRecorder.record(
                symbol, RECOVERY_FAIL, SignalLifecycleState.NEW, score,
                recoveryFailEvaluator.toDebugMap(eval), i.getClose(), i.getVolume(),
                i.getRelativeVolume(), "BELOW");

        telegramAlertService.sendRecoveryFailAlert(symbol, signal.getPrice(), reasons, putLabel);
        symbolContextRegistry.updateSignalState(symbol, RECOVERY_FAIL, SignalLifecycleState.NEW);
    }

    private boolean isDuplicate(String symbol) {
        LocalDate today = MarketTime.now().toLocalDate();
        LocalDateTime since = today.atStartOfDay();
        return tradingSignalRepository.findBySymbolAndTimestampAfterOrderByTimestampDesc(symbol, since)
                .stream()
                .anyMatch(s -> RECOVERY_FAIL.equals(s.getSignalType()));
    }
}
