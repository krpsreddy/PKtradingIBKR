package com.tradingbot.signals;

import com.tradingbot.alerts.TelegramAlertService;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.repository.TradingSignalRepository;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImbalanceSignalService {

    public static final String IMBALANCE_DOWN = SignalType.IMBALANCE_DOWN.code();
    public static final String IMBALANCE_UP = SignalType.IMBALANCE_UP.code();

    private final ImbalanceBreakEvaluator imbalanceBreakEvaluator;
    private final MarketHoursService marketHoursService;
    private final TradingSignalRepository tradingSignalRepository;
    private final SignalLifecycleService signalLifecycleService;
    private final TelegramAlertService telegramAlertService;
    private final SymbolContextRegistry symbolContextRegistry;
    private final MarketReplayRecorderService replayRecorder;

    public void evaluateImbalance(String symbol, IndicatorResult indicators) {
        if (indicators == null || !indicators.isValid() || !marketHoursService.isMarketOpen()) {
            return;
        }

        ImbalanceBreakEvaluator.ImbalanceEvaluation eval = imbalanceBreakEvaluator.evaluate(indicators);

        if (eval.isImbalanceDown() && !isDuplicate(symbol, IMBALANCE_DOWN)) {
            int score = eval.downScore();
            persist(symbol, indicators, IMBALANCE_DOWN, score,
                    imbalanceBreakEvaluator.downLabel(score),
                    imbalanceBreakEvaluator.buildDownChips(eval),
                    imbalanceBreakEvaluator.toDebugMap(eval), "PUT");
        }
        if (eval.isImbalanceUp() && !isDuplicate(symbol, IMBALANCE_UP) && !isPutBiasDay(symbol)) {
            int score = eval.upScore();
            persist(symbol, indicators, IMBALANCE_UP, score,
                    imbalanceBreakEvaluator.upLabel(score),
                    imbalanceBreakEvaluator.buildUpChips(eval),
                    imbalanceBreakEvaluator.toDebugMap(eval), "CALL");
        }
    }

    public ImbalanceBreakEvaluator.ImbalanceEvaluation evaluateForDebug(IndicatorResult indicators) {
        return imbalanceBreakEvaluator.evaluate(indicators);
    }

    private void persist(String symbol, IndicatorResult i, String signalType, int score,
                       String label, List<String> reasons, java.util.Map<String, Boolean> debug,
                       String optionHint) {
        String reasonSummary = String.join(" + ", reasons) + " (" + label + " " + score + "/6) [" + optionHint + "]";

        TradingSignal signal = TradingSignal.builder()
                .symbol(symbol)
                .signalType(signalType)
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
        log.info("Signal generated: {} {} at price={} score={} — {}", signalType, symbol, signal.getPrice(), score, reasonSummary);

        replayRecorder.record(symbol, signalType, SignalLifecycleState.NEW, score, debug,
                i.getClose(), i.getVolume(), i.getRelativeVolume(),
                IMBALANCE_UP.equals(signalType) ? "ABOVE" : "BELOW");

        if (IMBALANCE_DOWN.equals(signalType)) {
            telegramAlertService.sendImbalanceDownAlert(symbol, signal.getPrice(), reasons, label);
        } else {
            telegramAlertService.sendImbalanceUpAlert(symbol, signal.getPrice(), reasons, label);
        }
        symbolContextRegistry.updateSignalState(symbol, signalType, SignalLifecycleState.NEW);
    }

    private boolean isPutBiasDay(String symbol) {
        LocalDateTime since = MarketTime.now().toLocalDate().atStartOfDay();
        return tradingSignalRepository.findBySymbolAndTimestampAfterOrderByTimestampDesc(symbol, since)
                .stream()
                .anyMatch(s -> OpenFailSignalService.OPEN_FAIL.equals(s.getSignalType())
                        || OpenFailSignalService.OPEN_FAIL_BREAK.equals(s.getSignalType())
                        || RecoveryFailSignalService.RECOVERY_FAIL.equals(s.getSignalType())
                        || IMBALANCE_DOWN.equals(s.getSignalType()));
    }

    private boolean isDuplicate(String symbol, String signalType) {
        LocalDateTime since = MarketTime.now().toLocalDate().atStartOfDay();
        return tradingSignalRepository.findBySymbolAndTimestampAfterOrderByTimestampDesc(symbol, since)
                .stream()
                .anyMatch(s -> signalType.equals(s.getSignalType()));
    }
}
