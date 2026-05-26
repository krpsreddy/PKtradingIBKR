package com.tradingbot.signals;

import com.tradingbot.alerts.TelegramAlertService;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.intelligence.ExecutionIntelligenceService;
import com.tradingbot.intelligence.IntradayIntelligenceService;
import com.tradingbot.intelligence.SignalConfidenceAdjuster;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.repository.TradingSignalRepository;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import com.tradingbot.services.MarketTrendService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SignalEngineService {

    public static final String MOM_BUY = SignalType.MOM_BUY.code();
    public static final String PULL_BUY = SignalType.PULL_BUY.code();
    public static final String CONT_BUY = SignalType.CONT_BUY.code();
    public static final String EXIT = SignalType.EXIT.code();

    private final TradingSignalRepository tradingSignalRepository;
    private final TelegramAlertService telegramAlertService;
    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;
    private final MarketTrendService marketTrendService;
    private final SignalLifecycleService signalLifecycleService;
    private final ContinuationBuyEvaluator continuationBuyEvaluator;
    private final MomentumPullbackEvaluator momentumPullbackEvaluator;
    private final com.tradingbot.symbol.SymbolContextRegistry symbolContextRegistry;
    private final SignalConfidenceAdjuster signalConfidenceAdjuster;
    private final ExecutionIntelligenceService executionIntelligenceService;
    private final IntradayIntelligenceService intradayIntelligenceService;

    private final ConcurrentMap<String, SymbolState> symbolStates = new ConcurrentHashMap<>();

    private volatile String lastSignalReason = "No signals yet";

    public String getLastSignalReason() {
        return lastSignalReason;
    }

    public static List<String> parseReasons(String signalReasons) {
        if (signalReasons == null || signalReasons.isBlank()) {
            return List.of();
        }
        return Arrays.stream(signalReasons.split("\\|"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private SymbolState stateFor(String symbol) {
        return symbolStates.computeIfAbsent(symbol, s -> new SymbolState());
    }

    public void evaluateSignals(String symbol, IndicatorResult indicators) {
        if (indicators == null || !indicators.isValid()) {
            return;
        }
        if (!marketHoursService.isMarketOpen()) {
            log.debug("Skipping signals for {} — outside market hours (9:35–15:30 ET)", symbol);
            return;
        }

        SymbolState state = stateFor(symbol);
        updateTrendCycle(state, indicators);

        MomentumPullbackEvaluator.MomPullEvaluation momPull = momentumPullbackEvaluator.evaluate(indicators);
        updateMomPullReadiness(symbol, momPull);

        if (state.momPositionActive) {
            state.barsSinceMomEntry++;
            evaluateExit(symbol, state, indicators);
        }

        evaluateMomBuy(symbol, state, indicators, momPull);
        evaluatePullBuy(symbol, indicators, momPull);
        evaluateContBuy(symbol, indicators);
        signalLifecycleService.refreshLifecycle(symbol, indicators);
    }

    private void updateMomPullReadiness(String symbol, MomentumPullbackEvaluator.MomPullEvaluation eval) {
        String readiness = eval.isMomReady() ? MomentumPullbackEvaluator.READINESS_MOM_READY
                : eval.pullReadinessState();
        symbolContextRegistry.updateReadinessState(symbol, readiness);
    }

    private void evaluateContBuy(String symbol, IndicatorResult i) {
        if (isPutBiasBlocked(symbol)) {
            symbolContextRegistry.updateReadinessState(symbol, "");
            return;
        }
        ContinuationBuyEvaluator.ContEvaluation eval = continuationBuyEvaluator.evaluate(i, false);
        symbolContextRegistry.updateReadinessState(symbol, eval.readinessState());

        if (!eval.isContBuy()) {
            return;
        }
        if (isDuplicate(symbol, CONT_BUY)) {
            log.debug("CONT BUY dedupe — already sent within {} min for {}",
                    tradingProperties.getSignalDedupeMinutes(), symbol);
            return;
        }

        int confidence = continuationBuyEvaluator.calculateConfidence(i, eval);
        List<String> reasons = continuationBuyEvaluator.buildReasonChips(i, eval);
        String label = continuationBuyEvaluator.confidenceLabel(confidence);
        persistAndAlert(symbol, CONT_BUY, i, reasons, confidence, label);
        symbolContextRegistry.updateReadinessState(symbol, "");
    }

    private void updateTrendCycle(SymbolState state, IndicatorResult i) {
        if (!state.momBuyCycleActive) {
            return;
        }
        boolean macdBearish = i.getMacd().compareTo(i.getSignalLine()) < 0;
        boolean emaCrossDown = crossedBelow(i.getPreviousEma9(), i.getPreviousEma20(), i.getEma9(), i.getEma20());
        if (macdBearish || emaCrossDown) {
            state.momBuyCycleActive = false;
            log.debug("MOM BUY cycle reset — MACD bearish or EMA9 crossed below EMA20");
        }
    }

    private void evaluateMomBuy(String symbol, SymbolState state, IndicatorResult i,
                                MomentumPullbackEvaluator.MomPullEvaluation eval) {
        if (!eval.isMomBuy()) {
            return;
        }
        if (isPutBiasBlocked(symbol)) {
            log.debug("MOM BUY blocked — PUT-bias day for {}", symbol);
            return;
        }
        if (state.momBuyCycleActive) {
            log.debug("MOM BUY blocked — trend cycle not reset for {}", symbol);
            return;
        }
        if (isDuplicate(symbol, MOM_BUY)) {
            log.debug("MOM BUY dedupe — already sent within {} min for {}", tradingProperties.getSignalDedupeMinutes(), symbol);
            return;
        }

        int confidence = eval.getMomConfidence();
        List<String> reasons = momentumPullbackEvaluator.buildMomReasonChips(eval);
        persistAndAlert(symbol, MOM_BUY, i, reasons, confidence,
                momentumPullbackEvaluator.confidenceLabel(confidence));
        state.momBuyCycleActive = true;
        state.momPositionActive = true;
        state.barsSinceMomEntry = 0;
        symbolContextRegistry.updateReadinessState(symbol, "");
    }

    private void evaluatePullBuy(String symbol, IndicatorResult i,
                                 MomentumPullbackEvaluator.MomPullEvaluation eval) {
        if (!eval.isPullBuy()) {
            return;
        }
        if (isDuplicate(symbol, PULL_BUY)) {
            log.debug("PULL BUY dedupe — already sent within {} min for {}", tradingProperties.getSignalDedupeMinutes(), symbol);
            return;
        }

        int confidence = eval.getPullConfidence();
        List<String> reasons = momentumPullbackEvaluator.buildPullReasonChips(eval);
        persistAndAlert(symbol, PULL_BUY, i, reasons, confidence,
                momentumPullbackEvaluator.confidenceLabel(confidence));
        symbolContextRegistry.updateReadinessState(symbol, "");
    }

    private void evaluateExit(String symbol, SymbolState state, IndicatorResult i) {
        if (!momentumPullbackEvaluator.shouldExit(i, state.barsSinceMomEntry)) {
            return;
        }
        if (isDuplicate(symbol, EXIT)) {
            log.debug("EXIT dedupe — already sent within {} min for {}", tradingProperties.getSignalDedupeMinutes(), symbol);
            return;
        }

        List<String> reasons = momentumPullbackEvaluator.buildExitReasons(i);
        TradingSignal exit = persistAndAlert(symbol, EXIT, i, reasons, 0, null);
        signalLifecycleService.markExited(symbol, exit);
        state.momPositionActive = false;
        state.momBuyCycleActive = false;
        state.barsSinceMomEntry = 0;
    }

    private TradingSignal persistAndAlert(String symbol, String signalType, IndicatorResult i,
                                          List<String> reasons, int confidence, String confidenceLabelOverride) {
        if (MOM_BUY.equals(signalType) || CONT_BUY.equals(signalType)) {
            confidence = signalConfidenceAdjuster.adjustBuyConfidence(symbol, signalType, confidence, i);
            if (confidenceLabelOverride != null) {
                confidenceLabelOverride = defaultConfidenceLabel(confidence);
            }
        }
        String reasonsJoined = reasons.stream().collect(Collectors.joining("|"));
        String label = confidenceLabelOverride != null
                ? confidenceLabelOverride
                : defaultConfidenceLabel(confidence);
        String typeLabel = CONT_BUY.equals(signalType) ? label + " CONT BUY" : label;
        String reasonSummary = String.join(" + ", reasons) + " (" + typeLabel + " " + confidence + "/7)";

        TradingSignal signal = TradingSignal.builder()
                .symbol(symbol)
                .signalType(signalType)
                .price(i.getClose())
                .rsi(i.getRsi())
                .macd(i.getMacd())
                .vwap(i.getVwap())
                .confidenceScore(confidence)
                .signalReason(reasonSummary)
                .signalReasons(reasonsJoined)
                .relativeVolume(i.getRelativeVolume())
                .timestamp(MarketTime.nowLocal())
                .build();

        signalLifecycleService.onSignalCreated(signal);
        tradingSignalRepository.save(signal);
        lastSignalReason = reasonSummary;
        log.info("Signal generated: {} {} at price={} RSI={} confidence={} — {}",
                signalType, symbol, signal.getPrice(), signal.getRsi(), confidence, reasonSummary);

        if (shouldSendTelegram(symbol, signal, i)) {
            if (MOM_BUY.equals(signalType)) {
                telegramAlertService.sendMomBuyAlert(symbol, signal.getPrice(), i);
            } else if (PULL_BUY.equals(signalType)) {
                telegramAlertService.sendPullBuyAlert(symbol, signal.getPrice(), i);
            } else if (CONT_BUY.equals(signalType)) {
                telegramAlertService.sendContBuyAlert(symbol, signal.getPrice(), i);
            }
        } else {
            log.info("Telegram alert suppressed for {} {} — low execution priority or no edge", signalType, symbol);
        }
        return signal;
    }

    private boolean shouldSendTelegram(String symbol, TradingSignal signal, IndicatorResult i) {
        try {
            var intel = intradayIntelligenceService.analyzeSymbol(symbol, i, signal);
            return intel.getExecution() == null
                    || executionIntelligenceService.shouldSendTelegramAlert(intel.getExecution());
        } catch (Exception e) {
            return true;
        }
    }

    private String defaultConfidenceLabel(int confidence) {
        if (confidence >= 6) {
            return "ELITE";
        }
        if (confidence >= 4) {
            return "STRONG";
        }
        if (confidence >= 2) {
            return "GOOD";
        }
        return "WEAK";
    }

    public int calculateConfidence(IndicatorResult i) {
        return momentumPullbackEvaluator.calculateDisplayConfidence(i);
    }

    public MomentumPullbackEvaluator.MomPullEvaluation evaluateMomPull(IndicatorResult i) {
        return momentumPullbackEvaluator.evaluate(i);
    }

    public boolean wouldMomBuy(IndicatorResult i) {
        return momentumPullbackEvaluator.evaluate(i).isMomBuy();
    }

    public boolean wouldPullBuy(IndicatorResult i) {
        return momentumPullbackEvaluator.evaluate(i).isPullBuy();
    }

    public boolean wouldExit(IndicatorResult i, int barsSinceEntry) {
        return momentumPullbackEvaluator.shouldExit(i, barsSinceEntry);
    }

    private boolean crossedBelow(BigDecimal prevA, BigDecimal prevB, BigDecimal currA, BigDecimal currB) {
        if (prevA == null || prevB == null || currA == null || currB == null) {
            return false;
        }
        return prevA.compareTo(prevB) >= 0 && currA.compareTo(currB) < 0;
    }

    private boolean isDuplicate(String symbol, String signalType) {
        LocalDateTime since = MarketTime.nowLocal().minusMinutes(tradingProperties.getSignalDedupeMinutes());
        return tradingSignalRepository.findFirstBySymbolAndSignalTypeAndTimestampAfter(symbol, signalType, since).isPresent();
    }

    private boolean isPutBiasBlocked(String symbol) {
        var ctx = symbolContextRegistry.getOrCreate(symbol);
        if (OpenFailSignalService.OPEN_FAIL.equals(ctx.getSignalState())
                || OpenFailSignalService.OPEN_FAIL_BREAK.equals(ctx.getSignalState())
                || RecoveryFailSignalService.RECOVERY_FAIL.equals(ctx.getSignalState())
                || ImbalanceSignalService.IMBALANCE_DOWN.equals(ctx.getSignalState())) {
            return true;
        }
        LocalDateTime since = MarketTime.now().toLocalDate().atStartOfDay();
        return tradingSignalRepository.findBySymbolAndTimestampAfterOrderByTimestampDesc(symbol, since)
                .stream()
                .anyMatch(s -> OpenFailSignalService.OPEN_FAIL.equals(s.getSignalType())
                        || OpenFailSignalService.OPEN_FAIL_BREAK.equals(s.getSignalType())
                        || RecoveryFailSignalService.RECOVERY_FAIL.equals(s.getSignalType())
                        || ImbalanceSignalService.IMBALANCE_DOWN.equals(s.getSignalType()));
    }

    private static final class SymbolState {
        volatile boolean momBuyCycleActive = false;
        volatile boolean momPositionActive = false;
        volatile int barsSinceMomEntry = 0;
    }
}
