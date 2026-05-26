package com.tradingbot.signals;

import com.tradingbot.alerts.TelegramAlertService;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.intelligence.SignalConfidenceAdjuster;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OpenMomentumSignalService {

    public static final String OPEN_MOM_BUY = SignalType.OPEN_MOM_BUY.code();

    private final OpenMomentumEvaluator openMomentumEvaluator;
    private final OpeningRangeService openingRangeService;
    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;
    private final TradingSignalRepository tradingSignalRepository;
    private final SignalLifecycleService signalLifecycleService;
    private final TelegramAlertService telegramAlertService;
    private final SymbolContextRegistry symbolContextRegistry;
    private final TradingSymbolService tradingSymbolService;
    private final MarketReplayRecorderService replayRecorder;
    private final SignalConfidenceAdjuster signalConfidenceAdjuster;

    public void evaluateOpenMomentum(String symbol, IndicatorResult indicators) {
        if (indicators == null || !indicators.isValid()) {
            return;
        }
        if (!marketHoursService.isOpenMomentumWindow()) {
            return;
        }

        List<com.tradingbot.models.Candle> candles = indicators.getRecentCandles();
        openingRangeService.updateOpeningRange(symbol, candles);

        SymbolContext ctx = symbolContextRegistry.getOrCreate(symbol);
        TradingSymbol row = tradingSymbolService.findActive(symbol).orElse(null);
        Long avgDailyVol = row != null ? row.getAvgDailyVolume() : null;

        OpenMomentumEvaluator.OpenEvaluation eval = openMomentumEvaluator.evaluate(
                indicators, ctx, avgDailyVol,
                tradingProperties.getOpenMomMinBarVolume(),
                tradingProperties.getOpenMomMinAvgDailyVolume());

        if (eval.getGapPercent() != null) {
            ctx.setGapPercent(eval.getGapPercent());
        }
        symbolContextRegistry.updateOpenReadinessState(symbol, eval.readinessState());

        int score = openMomentumEvaluator.calculateScore(indicators, eval);
        boolean aboveVwap = indicators.getClose().compareTo(indicators.getVwap()) > 0;
        String replayType = eval.isOpenMomBuy() ? OPEN_MOM_BUY
                : eval.isOpenReady() ? OpenMomentumEvaluator.READINESS_OPEN_READY : "OPEN_MOM_EVAL";
        replayRecorder.recordFromEval(symbol, replayType, score,
                openMomentumEvaluator.toDebugMap(eval), indicators.getClose(),
                indicators.getVolume(), indicators.getRelativeVolume(), aboveVwap);

        if (!eval.isOpenMomBuy()) {
            return;
        }
        if (ctx.isOpenScoutActive()) {
            log.info("Signal evolution OPEN_SCOUT -> OPEN_MOM_BUY for {}", symbol);
            ctx.setOpenScoutActive(false);
        }
        if (isDuplicate(symbol, OPEN_MOM_BUY)) {
            log.debug("OPEN MOM BUY dedupe — already sent within {} min for {}",
                    tradingProperties.getSignalDedupeMinutes(), symbol);
            return;
        }

        List<String> reasons = openMomentumEvaluator.buildReasonChips(eval);
        int adjustedScore = signalConfidenceAdjuster.adjustBuyConfidence(
                symbol, OPEN_MOM_BUY, score, indicators);
        String label = openMomentumEvaluator.scoreLabel(adjustedScore);
        persistAndAlert(symbol, indicators, reasons, adjustedScore, label, eval.getGapPercent());
        symbolContextRegistry.updateOpenReadinessState(symbol, "");
    }

    public OpenMomentumEvaluator.OpenEvaluation evaluateForDebug(String symbol, IndicatorResult indicators) {
        openingRangeService.updateOpeningRange(symbol, indicators.getRecentCandles());
        SymbolContext ctx = symbolContextRegistry.getOrCreate(symbol);
        TradingSymbol row = tradingSymbolService.findActive(symbol).orElse(null);
        Long avgDailyVol = row != null ? row.getAvgDailyVolume() : null;
        return openMomentumEvaluator.evaluate(
                indicators, ctx, avgDailyVol,
                tradingProperties.getOpenMomMinBarVolume(),
                tradingProperties.getOpenMomMinAvgDailyVolume());
    }

    private void persistAndAlert(String symbol, IndicatorResult i, List<String> reasons,
                                 int score, String label, Double gapPercent) {
        String reasonsJoined = reasons.stream().collect(Collectors.joining("|"));
        String reasonSummary = String.join(" + ", reasons) + " (" + label + " " + score + "/7)";

        TradingSignal signal = TradingSignal.builder()
                .symbol(symbol)
                .signalType(OPEN_MOM_BUY)
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
        log.info("Signal generated: OPEN_MOM_BUY {} at price={} score={} — {}",
                symbol, signal.getPrice(), score, reasonSummary);

        telegramAlertService.sendOpenMomBuyAlert(symbol, signal.getPrice(), i, gapPercent);
    }

    private boolean isDuplicate(String symbol, String signalType) {
        LocalDateTime since = MarketTime.nowLocal().minusMinutes(tradingProperties.getSignalDedupeMinutes());
        return tradingSignalRepository
                .findFirstBySymbolAndSignalTypeAndTimestampAfter(symbol, signalType, since)
                .isPresent();
    }
}
