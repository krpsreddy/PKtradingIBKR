package com.tradingbot.signals;

import com.tradingbot.alerts.TelegramAlertService;
import com.tradingbot.candle.CandleAggregatorService;
import com.tradingbot.candle.LiveCandleSnapshot;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorCalculationService;
import com.tradingbot.models.Candle;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.models.TradingSymbol;
import com.tradingbot.repository.CandleRepository;
import com.tradingbot.repository.TradingSignalRepository;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import com.tradingbot.services.TradingPipelineService;
import com.tradingbot.services.TradingSymbolService;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class OpenScoutSignalService {

    public static final String OPEN_SCOUT = SignalType.OPEN_SCOUT.code();

    private final OpenScoutEvaluator openScoutEvaluator;
    private final CandleAggregatorService candleAggregatorService;
    private final CandleRepository candleRepository;
    private final IndicatorCalculationService indicatorCalculationService;
    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;
    private final TradingSignalRepository tradingSignalRepository;
    private final SignalLifecycleService signalLifecycleService;
    private final TelegramAlertService telegramAlertService;
    private final SymbolContextRegistry symbolContextRegistry;
    private final TradingSymbolService tradingSymbolService;
    @Lazy
    private final TradingPipelineService tradingPipelineService;
    private final MarketReplayRecorderService replayRecorder;

    public void onTick(String symbol, double price) {
        if (!tradingPipelineService.isLiveSignalsEnabled()) {
            return;
        }
        if (!marketHoursService.isOpenScoutWindow()) {
            return;
        }
        if (!tradingSymbolService.getScanSymbolSet().contains(symbol.toUpperCase())) {
            return;
        }
        evaluateLive(symbol, price);
    }

    public void sweepSymbol(String symbol) {
        if (!tradingPipelineService.isLiveSignalsEnabled() || !marketHoursService.isOpenScoutWindow()) {
            return;
        }
        Optional<LiveCandleSnapshot> snap = candleAggregatorService.getLiveSnapshot(symbol);
        double price = snap.map(s -> s.close().doubleValue()).orElse(0.0);
        if (price <= 0) {
            return;
        }
        evaluateLive(symbol, price);
    }

    public OpenScoutEvaluator.ScoutEvaluation evaluateForDebug(String symbol) {
        String sym = symbol.toUpperCase();
        SymbolContext ctx = symbolContextRegistry.getOrCreate(sym);
        Optional<LiveCandleSnapshot> snapOpt = candleAggregatorService.getLiveSnapshot(sym);
        LiveCandleSnapshot snap = snapOpt.orElse(buildFallbackSnapshot(sym));
        BigDecimal liveVwap = computeLiveVwap(sym, snap);
        ctx.setLiveVwap(liveVwap);

        List<Candle> candles = loadAllCandles(sym);
        Long avgVol = indicatorCalculationService.calculateIndicators(candles).getAvgVolume();
        long avgBarVol = avgVol != null ? avgVol : 0L;
        Double gap = calculateGapPercent(sym, candles);
        BigDecimal sessionOpen = resolveSessionOpen(sym, snap, candles);

        return openScoutEvaluator.evaluate(
                snap, ctx, liveVwap, sessionOpen, avgBarVol, gap);
    }

    private void evaluateLive(String symbol, double price) {
        String sym = symbol.toUpperCase();
        SymbolContext ctx = symbolContextRegistry.getOrCreate(sym);
        long nowMs = System.currentTimeMillis();
        if (nowMs - ctx.getLastScoutEvalMs() < tradingProperties.getOpenScoutEvalIntervalMs()) {
            return;
        }
        ctx.setLastScoutEvalMs(nowMs);

        TradingSymbol row = tradingSymbolService.findActive(sym).orElse(null);
        if (row != null && row.getAvgDailyVolume() != null) {
            ctx.setAvgDailyVolume(row.getAvgDailyVolume());
        }

        Optional<LiveCandleSnapshot> snapOpt = candleAggregatorService.getLiveSnapshot(sym);
        if (snapOpt.isEmpty()) {
            return;
        }
        LiveCandleSnapshot snap = snapOpt.get();
        BigDecimal liveVwap = computeLiveVwap(sym, snap);
        ctx.setLiveVwap(liveVwap);
        ctx.setLastPrice(price);

        List<Candle> candles = loadAllCandles(sym);
        long avgBarVol = avgBarVolume(candles);
        Double gap = calculateGapPercent(sym, candles);
        BigDecimal sessionOpen = resolveSessionOpen(sym, snap, candles);
        if (sessionOpen != null) {
            ctx.setSessionOpenPrice(sessionOpen);
        }

        OpenScoutEvaluator.ScoutEvaluation eval = openScoutEvaluator.evaluate(
                snap, ctx, liveVwap, sessionOpen, avgBarVol, gap);
        ctx.setLiveEstimatedRvol(eval.getEstimatedRvol());
        ctx.setLiveBodyStrength(eval.getLiveBodyStrength());
        if (gap != null) {
            ctx.setGapPercent(gap);
        }

        recordScoutReplay(sym, snap, eval, liveVwap);

        LocalDate today = MarketTime.now().toLocalDate();
        if (ctx.isOpenScoutFired() && today.equals(ctx.getOpenScoutSessionDate())) {
            handleActiveScout(sym, ctx, snap, eval, liveVwap, price, gap);
            return;
        }
        if (scoutAlreadyFiredToday(sym, today)) {
            return;
        }

        if (eval.isScoutReadyForOpenReady()) {
            symbolContextRegistry.updateOpenReadinessState(sym, OpenMomentumEvaluator.READINESS_OPEN_READY);
        }

        if (!eval.isOpenScout()) {
            return;
        }

        fireScout(sym, snap, eval, liveVwap, gap);
    }

    private void handleActiveScout(String sym, SymbolContext ctx, LiveCandleSnapshot snap,
                                   OpenScoutEvaluator.ScoutEvaluation eval, BigDecimal liveVwap,
                                   double price, Double gap) {
        if (eval.isFailed(price, liveVwap, snap)) {
            expireScout(sym, ctx, "Momentum failed / VWAP loss / rejection");
            return;
        }
        ctx.setOpenScoutActive(true);
        if (eval.isScoutReadyForOpenReady() || eval.isPremarketBreakout()) {
            symbolContextRegistry.updateOpenReadinessState(sym, OpenMomentumEvaluator.READINESS_OPEN_READY);
        }
    }

    private void fireScout(String sym, LiveCandleSnapshot snap, OpenScoutEvaluator.ScoutEvaluation eval,
                           BigDecimal liveVwap, Double gap) {
        int score = openScoutEvaluator.calculateScore(eval);
        List<String> reasons = openScoutEvaluator.buildReasonChips(eval);
        String label = openScoutEvaluator.scoreLabel(score);
        String reasonsJoined = String.join("|", reasons);
        String reasonSummary = String.join(" + ", reasons) + " (" + label + " " + score + "/" + OpenScoutEvaluator.MAX_SCORE + ")";

        TradingSignal signal = TradingSignal.builder()
                .symbol(sym)
                .signalType(OPEN_SCOUT)
                .price(snap.close())
                .vwap(liveVwap)
                .confidenceScore(score)
                .signalReason(reasonSummary)
                .signalReasons(reasonsJoined)
                .relativeVolume(eval.getEstimatedRvol() != null
                        ? BigDecimal.valueOf(eval.getEstimatedRvol()).setScale(2, RoundingMode.HALF_UP)
                        : null)
                .timestamp(MarketTime.nowLocal())
                .build();

        signalLifecycleService.onSignalCreated(signal);
        tradingSignalRepository.save(signal);
        log.info("Signal generated: OPEN_SCOUT {} at price={} score={} — {}", sym, signal.getPrice(), score, reasonSummary);

        SymbolContext ctx = symbolContextRegistry.getOrCreate(sym);
        ctx.setOpenScoutFired(true);
        ctx.setOpenScoutActive(true);
        ctx.setOpenScoutFailed(false);
        ctx.setOpenScoutSessionDate(MarketTime.now().toLocalDate());
        symbolContextRegistry.updateSignalState(sym, OPEN_SCOUT, SignalLifecycleState.NEW);
        symbolContextRegistry.updateOpenReadinessState(sym, OpenMomentumEvaluator.READINESS_OPEN_READY);

        telegramAlertService.sendOpenScoutAlert(sym, snap.close(), gap, eval.getEstimatedRvol(), reasons);
    }

    private void expireScout(String sym, SymbolContext ctx, String reason) {
        ctx.setOpenScoutActive(false);
        ctx.setOpenScoutFailed(true);
        symbolContextRegistry.updateSignalState(sym, OPEN_SCOUT, OpenScoutEvaluator.SCOUT_FAILED);
        symbolContextRegistry.updateOpenReadinessState(sym, "");

        LocalDateTime since = MarketTime.nowLocal().toLocalDate().atStartOfDay();
        tradingSignalRepository.findBySymbolAndTimestampAfterOrderByTimestampDesc(sym, since).stream()
                .filter(s -> OPEN_SCOUT.equals(s.getSignalType()))
                .filter(s -> !SignalLifecycleState.INVALIDATED.equals(s.getLifecycleState()))
                .findFirst()
                .ifPresent(s -> {
                    s.setLifecycleState(SignalLifecycleState.INVALIDATED);
                    s.setInvalidationReason(OpenScoutEvaluator.SCOUT_FAILED + ": " + reason);
                    s.setLastUpdated(MarketTime.nowLocal());
                    tradingSignalRepository.save(s);
                });
        log.info("OPEN_SCOUT expired for {} — {}", sym, reason);
    }

    private void recordScoutReplay(String sym, LiveCandleSnapshot snap,
                                   OpenScoutEvaluator.ScoutEvaluation eval, BigDecimal liveVwap) {
        Map<String, Boolean> cond = new LinkedHashMap<>();
        openScoutEvaluator.toDebugMap(eval).forEach((k, v) -> {
            if (v instanceof Boolean b) {
                cond.put(k, b);
            }
        });
        int score = openScoutEvaluator.calculateScore(eval);
        boolean aboveVwap = liveVwap != null && snap.close().compareTo(liveVwap) > 0;
        replayRecorder.recordFromEval(sym, OPEN_SCOUT, score, cond, snap.close(), snap.volume(),
                eval.getEstimatedRvol() != null
                        ? BigDecimal.valueOf(eval.getEstimatedRvol()).setScale(2, RoundingMode.HALF_UP)
                        : null,
                aboveVwap);
    }

    private boolean scoutAlreadyFiredToday(String symbol, LocalDate today) {
        LocalDateTime since = today.atStartOfDay();
        return tradingSignalRepository.findBySymbolAndTimestampAfterOrderByTimestampDesc(symbol, since).stream()
                .anyMatch(s -> OPEN_SCOUT.equals(s.getSignalType()));
    }

    private BigDecimal computeLiveVwap(String symbol, LiveCandleSnapshot snap) {
        List<Candle> candles = loadAllCandles(symbol);
        LocalDate sessionDay = MarketTime.toMarketZoned(snap.openTime()).toLocalDate();

        double cumPv = 0;
        double cumVol = 0;
        for (Candle c : candles) {
            if (!MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(sessionDay)) {
                continue;
            }
            if (c.getOpenTime().equals(snap.openTime())) {
                continue;
            }
            double vol = c.getVolume() != null ? c.getVolume().doubleValue() : 0;
            if (vol <= 0) {
                continue;
            }
            double typical = (c.getHigh().doubleValue() + c.getLow().doubleValue() + c.getClose().doubleValue()) / 3.0;
            cumPv += typical * vol;
            cumVol += vol;
        }

        double liveVol = snap.volume();
        if (liveVol > 0) {
            double typical = (snap.high().doubleValue() + snap.low().doubleValue() + snap.close().doubleValue()) / 3.0;
            cumPv += typical * liveVol;
            cumVol += liveVol;
        }

        if (cumVol <= 0) {
            return snap.close();
        }
        return BigDecimal.valueOf(cumPv / cumVol).setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal resolveSessionOpen(String symbol, LiveCandleSnapshot snap, List<Candle> candles) {
        SymbolContext ctx = symbolContextRegistry.get(symbol);
        if (ctx != null && ctx.getSessionOpenPrice() != null) {
            return ctx.getSessionOpenPrice();
        }
        LocalDate sessionDay = MarketTime.now().toLocalDate();
        return candles.stream()
                .filter(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(sessionDay))
                .filter(c -> !MarketTime.toMarketZoned(c.getOpenTime()).toLocalTime().isBefore(LocalTime.of(9, 30)))
                .min(Comparator.comparing(Candle::getOpenTime))
                .map(Candle::getOpen)
                .orElse(snap.open());
    }

    private Double calculateGapPercent(String symbol, List<Candle> candles) {
        Candle prior = PremarketTrackerService.findPriorRthClose(candles);
        if (prior == null) {
            prior = candles.stream()
                    .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                    .max(Comparator.comparing(Candle::getOpenTime))
                    .orElse(null);
        }
        if (prior == null) {
            return null;
        }
        LocalDate today = MarketTime.now().toLocalDate();
        Candle openBar = candles.stream()
                .filter(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(today))
                .filter(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalTime().equals(LocalTime.of(9, 30)))
                .findFirst()
                .orElse(null);
        BigDecimal openPrice = openBar != null ? openBar.getOpen() : null;
        Optional<LiveCandleSnapshot> live = candleAggregatorService.getLiveSnapshot(symbol);
        if (openPrice == null && live.isPresent()) {
            openPrice = live.get().open();
        }
        if (openPrice == null || prior.getClose() == null || prior.getClose().compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        return openPrice.subtract(prior.getClose())
                .divide(prior.getClose(), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .doubleValue();
    }

    private long avgBarVolume(List<Candle> candles) {
        if (candles.isEmpty()) {
            return 0;
        }
        var result = indicatorCalculationService.calculateIndicators(candles);
        if (!result.isValid() || result.getAvgVolume() == null) {
            return 0;
        }
        return result.getAvgVolume();
    }

    private List<Candle> loadAllCandles(String symbol) {
        return candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, tradingProperties.getTimeframe())
                .stream()
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
    }

    private LiveCandleSnapshot buildFallbackSnapshot(String symbol) {
        List<Candle> candles = loadAllCandles(symbol);
        Candle last = candles.isEmpty() ? null : candles.get(candles.size() - 1);
        if (last == null) {
            return new LiveCandleSnapshot(symbol, MarketTime.nowLocal(),
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0);
        }
        return new LiveCandleSnapshot(symbol, last.getOpenTime(),
                last.getOpen(), last.getHigh(), last.getLow(), last.getClose(),
                last.getVolume() != null ? last.getVolume() : 0);
    }
}
