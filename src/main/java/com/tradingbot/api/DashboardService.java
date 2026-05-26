package com.tradingbot.api;

import com.tradingbot.api.dto.ActiveSignalDto;
import com.tradingbot.api.dto.CandleChartDto;
import com.tradingbot.api.dto.DebugDto;
import com.tradingbot.api.dto.HotMomentumDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.IndicatorDto;
import com.tradingbot.api.dto.SignalDto;
import com.tradingbot.api.dto.SymbolSubscribeDto;
import com.tradingbot.api.dto.SystemStatusDto;
import com.tradingbot.api.dto.TradingSymbolDto;
import com.tradingbot.api.dto.WatchlistItemDto;
import com.tradingbot.config.IBKRProperties;
import com.tradingbot.config.SymbolEnrichmentCache;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorCalculationService;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.Candle;
import com.tradingbot.models.IndicatorSnapshot;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.models.TradingSymbol;
import com.tradingbot.repository.CandleRepository;
import com.tradingbot.repository.IndicatorSnapshotRepository;
import com.tradingbot.repository.TradingSignalRepository;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import com.tradingbot.services.TradingPipelineService;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.ibkr.SubscriptionManagerService;
import com.tradingbot.services.MarketTrendService;
import com.tradingbot.api.dto.MomPullDebugDto;
import com.tradingbot.api.dto.OpenFailDebugDto;
import com.tradingbot.api.dto.OpenMomentumDebugDto;
import com.tradingbot.api.dto.OpenScoutDebugDto;
import com.tradingbot.api.dto.OpeningMomentumDto;
import com.tradingbot.api.dto.RecoveryFailDebugDto;
import com.tradingbot.api.dto.ReplayEventDto;
import com.tradingbot.api.dto.EngineWindowDto;
import com.tradingbot.api.dto.SignalHealthDto;
import com.tradingbot.models.SignalEvaluationSnapshot;
import com.tradingbot.signals.ContinuationBuyEvaluator;
import com.tradingbot.signals.MarketReplayRecorderService;
import com.tradingbot.signals.MomentumPullbackEvaluator;
import com.tradingbot.signals.ImbalanceSignalService;
import com.tradingbot.signals.OpenFailEvaluator;
import com.tradingbot.signals.OpenFailSignalService;
import com.tradingbot.signals.RecoveryFailEvaluator;
import com.tradingbot.signals.RecoveryFailSignalService;
import com.tradingbot.signals.OpenMomentumEvaluator;
import com.tradingbot.signals.OpenMomentumSignalService;
import com.tradingbot.signals.OpenScoutEvaluator;
import com.tradingbot.signals.OpenScoutSignalService;
import com.tradingbot.signals.SignalEngineService;
import com.tradingbot.signals.SignalLifecycleState;
import com.tradingbot.signals.SignalType;
import com.tradingbot.services.SymbolLoadService;
import com.tradingbot.services.TradingSymbolService;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import com.tradingbot.api.dto.CreateTradingSymbolRequest;
import com.tradingbot.intelligence.IntelligenceEnrichmentService;
import com.tradingbot.intelligence.IntradayIntelligenceService;
import com.tradingbot.intelligence.dto.MarketRegimeDto;
import com.tradingbot.intelligence.EmergingSetupService;
import com.tradingbot.intelligence.MarketInternalsService;
import com.tradingbot.api.dto.EmergingSetupItemDto;
import com.tradingbot.api.dto.ExecutionSnapshotDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.ta4j.core.BarSeries;
import org.ta4j.core.BaseBarSeriesBuilder;
import org.ta4j.core.indicators.EMAIndicator;
import org.ta4j.core.indicators.helpers.ClosePriceIndicator;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final CandleRepository candleRepository;
    private final IndicatorSnapshotRepository indicatorSnapshotRepository;
    private final TradingSignalRepository tradingSignalRepository;
    private final IndicatorCalculationService indicatorCalculationService;
    private final TradingPipelineService tradingPipelineService;
    private final IBKRClientService ibkrClientService;
    private final IBKRProperties ibkrProperties;
    private final TradingProperties tradingProperties;
    private final MarketHoursService marketHoursService;
    private final SignalEngineService signalEngineService;
    private final SymbolContextRegistry symbolContextRegistry;
    private final SymbolLoadService symbolLoadService;
    private final SubscriptionManagerService subscriptionManager;
    private final MarketTrendService marketTrendService;
    private final TradingSymbolService tradingSymbolService;
    private final OpenMomentumSignalService openMomentumSignalService;
    private final OpenMomentumEvaluator openMomentumEvaluator;
    private final OpenScoutSignalService openScoutSignalService;
    private final OpenScoutEvaluator openScoutEvaluator;
    private final OpenFailSignalService openFailSignalService;
    private final OpenFailEvaluator openFailEvaluator;
    private final RecoveryFailSignalService recoveryFailSignalService;
    private final RecoveryFailEvaluator recoveryFailEvaluator;
    private final MomentumPullbackEvaluator momentumPullbackEvaluator;
    private final MarketReplayRecorderService replayRecorder;
    private final IntelligenceEnrichmentService intelligenceEnrichmentService;
    private final IntradayIntelligenceService intradayIntelligenceService;
    private final EmergingSetupService emergingSetupService;
    private final MarketInternalsService marketInternalsService;
    private final SymbolEnrichmentCache symbolEnrichmentCache;

    public SymbolSubscribeDto subscribeSymbol(String symbol) {
        return symbolLoadService.activateSymbol(symbol);
    }

    public List<CandleChartDto> getLatestCandles() {
        return getLatestCandles(ibkrProperties.getSymbol());
    }

    public List<CandleChartDto> getLatestCandles(String symbol) {
        String sym = symbol.toUpperCase();
        symbolContextRegistry.touch(sym);
        symbolLoadService.activateSymbol(sym);
        String timeframe = tradingProperties.getTimeframe();
        List<Candle> candles = loadSessionCandles(sym, timeframe);
        if (candles.isEmpty()) {
            return List.of();
        }
        List<CandleChartDto> chart = enrichWithIndicators(candles);
        symbolContextRegistry.getOrCreate(sym).updateCache(chart);
        return chart;
    }

    public IndicatorDto getLatestIndicators() {
        return getLatestIndicators(ibkrProperties.getSymbol());
    }

    public IndicatorDto getLatestIndicators(String symbol) {
        String timeframe = tradingProperties.getTimeframe();
        List<Candle> candles = loadSessionCandles(symbol, timeframe);
        IndicatorResult result = indicatorCalculationService.calculateIndicators(candles);
        if (result.isValid()) {
            return toDto(result);
        }

        return indicatorSnapshotRepository.findAll().stream()
                .filter(s -> symbol.equalsIgnoreCase(s.getSymbol()))
                .max(Comparator.comparing(IndicatorSnapshot::getTimestamp))
                .map(this::toDto)
                .orElse(emptyIndicatorDto());
    }

    public List<SignalDto> getLatestSignals() {
        return getLatestSignals(null);
    }

    public List<SignalDto> getLatestSignals(String symbol) {
        return tradingSignalRepository.findAll().stream()
                .filter(s -> symbol == null || symbol.equalsIgnoreCase(s.getSymbol()))
                .sorted(Comparator.comparing(TradingSignal::getTimestamp).reversed())
                .limit(20)
                .map(s -> intelligenceEnrichmentService.enrichSignal(toSignalDto(s), s))
                .toList();
    }

    public List<HotMomentumDto> getHotMomentum() {
        LocalDateTime since = MarketTime.nowLocal().minusMinutes(tradingProperties.getActiveSignalMinutes());
        List<TradingSignal> candidates = tradingSignalRepository.findByTimestampAfterOrderByTimestampDesc(since).stream()
                .filter(s -> SignalType.isBuySignal(s.getSignalType())
                        || OpenScoutSignalService.OPEN_SCOUT.equals(s.getSignalType()))
                .toList();
        return enrichAndRankHot(candidates, 8);
    }

    public List<OpeningMomentumDto> getOpeningMomentum() {
        LocalDateTime since = MarketTime.nowLocal().minusMinutes(tradingProperties.getActiveSignalMinutes());
        List<TradingSignal> rawSignals = tradingSignalRepository.findByTimestampAfterOrderByTimestampDesc(since).stream()
                .filter(s -> OpenMomentumSignalService.OPEN_MOM_BUY.equals(s.getSignalType())
                        || OpenScoutSignalService.OPEN_SCOUT.equals(s.getSignalType()))
                .toList();

        List<OpeningMomentumDto> signals = new ArrayList<>();
        for (TradingSignal s : rawSignals) {
            OpeningMomentumDto base = toOpeningMomentumDto(s);
            signals.add(intelligenceEnrichmentService.enrichOpening(base, s, 0));
        }

        List<OpeningMomentumDto> ready = new ArrayList<>();
        for (TradingSymbol row : tradingSymbolService.findScanEnabled()) {
            SymbolContext ctx = symbolContextRegistry.get(row.getSymbol());
            if (ctx == null) {
                continue;
            }
            if (OpenMomentumEvaluator.READINESS_OPEN_READY.equals(ctx.getOpenReadinessState())
                    && !ctx.isOpenScoutActive()) {
                IndicatorDto ind = getLatestIndicators(row.getSymbol());
                ready.add(OpeningMomentumDto.builder()
                        .symbol(row.getSymbol())
                        .gapPercent(ctx.getGapPercent())
                        .relativeVolume(ind.getRelativeVolume() > 0 ? ind.getRelativeVolume() : null)
                        .confidenceScore(null)
                        .confidenceLabel("READY")
                        .signalType(OpenMomentumEvaluator.READINESS_OPEN_READY)
                        .lifecycleState(null)
                        .signalReasons(List.of("Massive Volume", "Above VWAP", "Waiting ORB Breakout"))
                        .build());
            }
            if (ctx.isOpenScoutActive() && !ctx.isOpenScoutFailed()
                    && signals.stream().noneMatch(s -> s.getSymbol().equalsIgnoreCase(row.getSymbol()))) {
                ready.add(OpeningMomentumDto.builder()
                        .symbol(row.getSymbol())
                        .gapPercent(ctx.getGapPercent())
                        .relativeVolume(ctx.getLiveEstimatedRvol())
                        .confidenceScore(null)
                        .confidenceLabel("EARLY SIGNAL")
                        .signalType(OpenScoutSignalService.OPEN_SCOUT)
                        .lifecycleState(SignalLifecycleState.NEW)
                        .signalReasons(List.of("Live scout active", "Waiting for confirmation"))
                        .build());
            }
        }

        List<OpeningMomentumDto> combined = new ArrayList<>();
        for (OpeningMomentumDto scout : signals.stream()
                .filter(s -> OpenScoutSignalService.OPEN_SCOUT.equals(s.getSignalType()))
                .toList()) {
            combined.add(scout);
        }
        combined.addAll(ready);
        for (OpeningMomentumDto dto : signals) {
            if (OpenScoutSignalService.OPEN_SCOUT.equals(dto.getSignalType())) {
                continue;
            }
            if (combined.stream().noneMatch(r -> r.getSymbol().equalsIgnoreCase(dto.getSymbol()))) {
                combined.add(dto);
            }
        }
        return combined.stream()
                .sorted(Comparator
                        .comparing((OpeningMomentumDto d) -> d.getRankScore() != null ? d.getRankScore() : 0, Comparator.reverseOrder())
                        .thenComparing(d -> scoutPriority(d.getSignalType()))
                        .thenComparing(d -> d.getConfidenceScore() != null ? d.getConfidenceScore() : 0, Comparator.reverseOrder()))
                .limit(12)
                .toList();
    }

    private int scoutPriority(String signalType) {
        if (OpenScoutSignalService.OPEN_SCOUT.equals(signalType)) {
            return 0;
        }
        if (OpenMomentumEvaluator.READINESS_OPEN_READY.equals(signalType)) {
            return 1;
        }
        if (OpenMomentumSignalService.OPEN_MOM_BUY.equals(signalType)) {
            return 2;
        }
        return 3;
    }

    public OpenMomentumDebugDto getOpenMomentumDebug(String symbol) {
        String sym = symbol.toUpperCase();
        List<Candle> candles = loadSessionCandles(sym, tradingProperties.getTimeframe());
        IndicatorResult indicators = indicatorCalculationService.calculateIndicators(candles);
        OpenMomentumEvaluator.OpenEvaluation eval = openMomentumSignalService.evaluateForDebug(sym, indicators);
        int score = indicators.isValid() ? openMomentumEvaluator.calculateScore(indicators, eval) : 0;
        return OpenMomentumDebugDto.builder()
                .symbol(sym)
                .inOpenWindow(marketHoursService.isOpenMomentumWindow())
                .score(score)
                .scoreLabel(openMomentumEvaluator.scoreLabel(score))
                .gapPercent(eval.getGapPercent())
                .conditions(openMomentumEvaluator.toDebugMap(eval))
                .reasonChips(indicators.isValid() ? openMomentumEvaluator.buildReasonChips(eval) : List.of())
                .build();
    }

    public OpenScoutDebugDto getOpenScoutDebug(String symbol) {
        String sym = symbol.toUpperCase();
        SymbolContext ctx = symbolContextRegistry.getOrCreate(sym);
        OpenScoutEvaluator.ScoutEvaluation eval = openScoutSignalService.evaluateForDebug(sym);
        int score = openScoutEvaluator.calculateScore(eval);
        return OpenScoutDebugDto.builder()
                .symbol(sym)
                .inScoutWindow(marketHoursService.isOpenScoutWindow())
                .score(score)
                .scoreLabel(openScoutEvaluator.scoreLabel(score))
                .gapPercent(eval.getGapPercent())
                .estimatedRvol(eval.getEstimatedRvol())
                .liveBodyStrength(eval.getLiveBodyStrength())
                .premarketBreakout(eval.isPremarketBreakout())
                .aboveVwap(eval.isAboveVwap())
                .conditions(openScoutEvaluator.toDebugMap(eval))
                .reasonChips(openScoutEvaluator.buildReasonChips(eval))
                .scoutActive(ctx.isOpenScoutActive())
                .scoutFailed(ctx.isOpenScoutFailed())
                .build();
    }

    public OpenFailDebugDto getOpenFailDebug(String symbol) {
        String sym = symbol.toUpperCase();
        List<Candle> candles = candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(sym, tradingProperties.getTimeframe())
                .stream()
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
        IndicatorResult indicators = indicatorCalculationService.calculateIndicators(candles);
        if (!indicators.isValid()) {
            return OpenFailDebugDto.builder()
                    .symbol(sym)
                    .inOpenFailWindow(marketHoursService.isOpenFailWindow())
                    .score(0)
                    .scoreLabel("NO FAIL")
                    .putSetupLabel("")
                    .conditions(Map.of())
                    .reasonChips(List.of())
                    .openFail(false)
                    .build();
        }
        OpenFailEvaluator.FailEvaluation eval = openFailSignalService.evaluateForDebug(sym, indicators);
        int score = eval.calculateScore();
        int breakScore = eval.calculateBreakScore();
        SymbolContext ctx = symbolContextRegistry.getOrCreate(sym);
        return OpenFailDebugDto.builder()
                .symbol(sym)
                .inOpenFailWindow(marketHoursService.isOpenFailWindow())
                .score(score)
                .scoreLabel(openFailEvaluator.scoreLabel(score))
                .putSetupLabel(openFailEvaluator.putSetupLabel(score))
                .upperWickPercent(eval.getUpperWickPercent())
                .conditions(openFailEvaluator.toDebugMap(eval))
                .reasonChips(openFailEvaluator.buildReasonChips(eval))
                .openFail(eval.isOpenFailSetup())
                .openFailSetup(eval.isOpenFailSetup())
                .openFailBreak(eval.isOpenFailBreak())
                .openFailPending(ctx.isOpenFailPendingSetup())
                .breakScore(breakScore)
                .breakScoreLabel(openFailEvaluator.breakScoreLabel(breakScore))
                .breakReasonChips(openFailEvaluator.buildBreakReasonChips(eval))
                .build();
    }

    public RecoveryFailDebugDto getRecoveryFailDebug(String symbol) {
        String sym = symbol.toUpperCase();
        List<Candle> candles = candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(sym, tradingProperties.getTimeframe())
                .stream()
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
        IndicatorResult indicators = indicatorCalculationService.calculateIndicators(candles);
        if (!indicators.isValid()) {
            return RecoveryFailDebugDto.builder()
                    .symbol(sym)
                    .inRecoveryFailWindow(marketHoursService.isRecoveryFailWindow())
                    .score(0)
                    .scoreLabel("NO RECOVERY FAIL")
                    .putSetupLabel("")
                    .conditions(Map.of())
                    .reasonChips(List.of())
                    .recoveryFailSetup(false)
                    .recoveryFailPending(false)
                    .build();
        }
        RecoveryFailEvaluator.RecoveryEvaluation eval = recoveryFailSignalService.evaluateForDebug(sym, indicators);
        int score = eval.calculateScore();
        SymbolContext ctx = symbolContextRegistry.getOrCreate(sym);
        return RecoveryFailDebugDto.builder()
                .symbol(sym)
                .inRecoveryFailWindow(marketHoursService.isRecoveryFailWindow())
                .score(score)
                .scoreLabel(recoveryFailEvaluator.scoreLabel(score))
                .putSetupLabel(recoveryFailEvaluator.putSetupLabel(score))
                .rallyFromLowPct(eval.getRallyFromLowPct())
                .conditions(recoveryFailEvaluator.toDebugMap(eval))
                .reasonChips(recoveryFailEvaluator.buildReasonChips(eval))
                .recoveryFailSetup(eval.isRecoveryFailSetup())
                .recoveryFailPending(ctx.isRecoveryFailPendingSetup())
                .build();
    }

    public MomPullDebugDto getMomPullDebug(String symbol) {
        String sym = symbol.toUpperCase();
        List<Candle> candles = candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(sym, tradingProperties.getTimeframe())
                .stream()
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
        IndicatorResult indicators = indicatorCalculationService.calculateIndicators(candles);
        if (!indicators.isValid()) {
            return MomPullDebugDto.builder()
                    .symbol(sym)
                    .inSignalWindow(marketHoursService.isMarketOpen())
                    .sessionLabel("REGULAR")
                    .requiredConfidence(tradingProperties.getMomPullMinConfidence())
                    .pullScore(0)
                    .momScore(0)
                    .pullScoreLabel("WEAK")
                    .momScoreLabel("WEAK")
                    .pullReady(false)
                    .pullBuy(false)
                    .momReady(false)
                    .momBuy(false)
                    .pullConditions(Map.of())
                    .momConditions(Map.of())
                    .pullReasonChips(List.of())
                    .momReasonChips(List.of())
                    .pullFailedConditions(List.of())
                    .momFailedConditions(List.of())
                    .build();
        }
        MomentumPullbackEvaluator.MomPullEvaluation eval = momentumPullbackEvaluator.evaluate(indicators);
        return MomPullDebugDto.builder()
                .symbol(sym)
                .inSignalWindow(marketHoursService.isMarketOpen())
                .sessionLabel(eval.getSessionLabel())
                .requiredConfidence(eval.getRequiredConfidence())
                .pullScore(eval.getPullConfidence())
                .momScore(eval.getMomConfidence())
                .pullScoreLabel(momentumPullbackEvaluator.confidenceLabel(eval.getPullConfidence()))
                .momScoreLabel(momentumPullbackEvaluator.confidenceLabel(eval.getMomConfidence()))
                .pullReady(eval.isPullReady())
                .pullBuy(eval.isPullBuy())
                .momReady(eval.isMomReady())
                .momBuy(eval.isMomBuy())
                .pullConditions(momentumPullbackEvaluator.toPullDebugMap(eval))
                .momConditions(momentumPullbackEvaluator.toMomDebugMap(eval))
                .pullReasonChips(momentumPullbackEvaluator.buildPullReasonChips(eval))
                .momReasonChips(momentumPullbackEvaluator.buildMomReasonChips(eval))
                .pullFailedConditions(momentumPullbackEvaluator.buildFailedConditions(eval, true))
                .momFailedConditions(momentumPullbackEvaluator.buildFailedConditions(eval, false))
                .build();
    }

    public List<HotMomentumDto> getFailedMomentum() {
        LocalDateTime since = MarketTime.nowLocal().toLocalDate().atStartOfDay();
        List<TradingSignal> candidates = tradingSignalRepository.findByTimestampAfterOrderByTimestampDesc(since).stream()
                .filter(s -> OpenFailSignalService.OPEN_FAIL.equals(s.getSignalType())
                        || OpenFailSignalService.OPEN_FAIL_BREAK.equals(s.getSignalType())
                        || RecoveryFailSignalService.RECOVERY_FAIL.equals(s.getSignalType())
                        || ImbalanceSignalService.IMBALANCE_DOWN.equals(s.getSignalType()))
                .toList();
        return enrichAndRankHot(candidates, 12);
    }

    public List<ReplayEventDto> getReplayTimeline(String symbol) {
        String sym = symbol.toUpperCase();
        LocalDateTime since = MarketTime.nowLocal().toLocalDate().atStartOfDay();
        return replayRecorder.timeline(sym, since).stream()
                .map(this::toReplayEventDto)
                .toList();
    }

    public List<HotMomentumDto> getContinuationSetups() {
        LocalDateTime since = MarketTime.nowLocal().minusMinutes(tradingProperties.getActiveSignalMinutes());
        List<TradingSignal> contSignals = tradingSignalRepository.findByTimestampAfterOrderByTimestampDesc(since).stream()
                .filter(s -> SignalEngineService.CONT_BUY.equals(s.getSignalType()))
                .toList();
        List<HotMomentumDto> recentCont = enrichAndRankHot(contSignals, contSignals.size());

        List<HotMomentumDto> ready = new ArrayList<>();
        for (TradingSymbol row : tradingSymbolService.findScanEnabled()) {
            SymbolContext ctx = symbolContextRegistry.get(row.getSymbol());
            if (ctx == null || !ContinuationBuyEvaluator.READINESS_CONT_READY.equals(ctx.getReadinessState())) {
                continue;
            }
            IndicatorDto ind = getLatestIndicators(row.getSymbol());
            ready.add(HotMomentumDto.builder()
                    .symbol(row.getSymbol())
                    .confidenceScore(null)
                    .confidenceLabel("READY")
                    .relativeVolume(ind.getRelativeVolume() > 0 ? ind.getRelativeVolume() : null)
                    .trend(resolveTrend(ind))
                    .signalType(ContinuationBuyEvaluator.READINESS_CONT_READY)
                    .lifecycleState(null)
                    .signalReasons(List.of("Tight Consolidation", "Bullish Trend", "Waiting Breakout"))
                    .build());
        }

        List<HotMomentumDto> combined = new ArrayList<>(ready);
        for (HotMomentumDto dto : recentCont) {
            if (combined.stream().noneMatch(r -> r.getSymbol().equalsIgnoreCase(dto.getSymbol()))) {
                combined.add(dto);
            }
        }
        return combined.stream()
                .sorted(Comparator.comparing(
                        HotMomentumDto::getRankScore, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(12)
                .toList();
    }

    public MarketTrendDto getMarketTrend() {
        MarketTrendDto base = marketTrendService.getMarketTrend();
        MarketRegimeDto regime = intradayIntelligenceService.getMarketRegime();
        String semi = marketInternalsService.semiBreadth();
        String ai = marketInternalsService.aiBreadth();
        double spyP = marketInternalsService.spyPersistence();
        double qqqP = marketInternalsService.qqqPersistence();
        double riskScore = marketInternalsService.riskOnScore(
                regime.isRiskOn(), regime.isRiskOn(), semi, ai);
        return MarketTrendDto.builder()
                .spyTrend(base.getSpyTrend())
                .qqqTrend(base.getQqqTrend())
                .marketAligned(base.isMarketAligned())
                .regime(regime.getRegime())
                .regimeSummary(regime.getSummary())
                .choppy(regime.isChoppy())
                .riskOn(regime.isRiskOn())
                .riskOnScore(riskScore)
                .semiBreadth(semi)
                .aiBreadth(ai)
                .spyPersistence(spyP)
                .qqqPersistence(qqqP)
                .build();
    }

    public ExecutionSnapshotDto getExecutionSnapshot(String symbol) {
        String sym = symbol.toUpperCase();
        TradingSignal latest = findLatestActiveSignal(sym);
        var intel = intelligenceEnrichmentService.analyze(sym, latest);
        return intelligenceEnrichmentService.toExecutionSnapshot(intel);
    }

    public List<EmergingSetupItemDto> getEmergingSetups() {
        return emergingSetupService.scanEmergingSetups().stream()
                .map(e -> EmergingSetupItemDto.builder()
                        .symbol(e.getSymbol())
                        .state(e.getState())
                        .setupType(e.getSetupType())
                        .description(e.getDescription())
                        .relativeVolume(e.getRelativeVolume())
                        .rankScore(e.getRankScore())
                        .build())
                .toList();
    }

    public List<ActiveSignalDto> getActiveSignals() {
        LocalDateTime since = MarketTime.nowLocal().minusMinutes(tradingProperties.getActiveSignalMinutes());
        List<TradingSignal> signals = tradingSignalRepository.findByTimestampAfterOrderByTimestampDesc(since).stream()
                .sorted(Comparator
                        .comparing(TradingSignal::getTimestamp).reversed()
                        .thenComparing(s -> s.getConfidenceScore() != null ? s.getConfidenceScore() : 0, Comparator.reverseOrder()))
                .toList();
        List<ActiveSignalDto> enriched = new ArrayList<>();
        for (TradingSignal s : signals) {
            enriched.add(intelligenceEnrichmentService.enrichActive(toActiveSignalDto(s), s));
        }
        enriched.sort(Comparator.comparing(
                ActiveSignalDto::getRankScore, Comparator.nullsLast(Comparator.reverseOrder())));
        return enriched;
    }

    public List<TradingSymbolDto> getEnrichedSymbols() {
        List<TradingSymbolDto> items = new ArrayList<>();
        for (TradingSymbol row : tradingSymbolService.findEnabledForDisplay()) {
            symbolContextRegistry.touch(row.getSymbol());
            items.add(enrichSymbol(row));
        }
        return items;
    }

    public List<TradingSymbolDto> enrichSymbolsBatch(com.tradingbot.api.dto.SymbolEnrichRequest request) {
        if (request == null || request.getSymbols() == null || request.getSymbols().isEmpty()) {
            return List.of();
        }
        return request.getSymbols().stream()
                .limit(8)
                .map(String::toUpperCase)
                .distinct()
                .map(sym -> tradingSymbolService.findEnabled(sym).orElse(null))
                .filter(java.util.Objects::nonNull)
                .map(this::enrichSymbol)
                .toList();
    }

    public TradingSymbolDto enrichSymbol(TradingSymbol row) {
        var cached = symbolEnrichmentCache.get(row.getSymbol());
        if (cached.isPresent()) {
            return cached.get();
        }
        WatchlistItemDto market = buildWatchlistItem(row.getSymbol());
        TradingSymbolDto dto = tradingSymbolService.toDto(row).toBuilder()
                .price(market.getPrice())
                .trend(market.getTrend())
                .trendIcon(market.getTrendIcon())
                .relativeVolume(market.getRelativeVolume())
                .signalState(market.getSignalState())
                .lifecycleState(market.getLifecycleState())
                .momentumState(market.getMomentumState())
                .readinessState(market.getReadinessState())
                .openReadinessState(market.getOpenReadinessState())
                .gapPercent(market.getGapPercent())
                .confidenceScore(market.getConfidenceScore())
                .confidenceLabel(market.getConfidenceLabel())
                .highRvol(market.isHighRvol())
                .historicalLoaded(market.isHistoricalLoaded())
                .liveSubscribed(market.isLiveSubscribed())
                .sparkline(market.getSparkline())
                .trend5m(market.getTrend5m())
                .trend15m(market.getTrend15m())
                .trend1h(market.getTrend1h())
                .mtfSummary(market.getMtfSummary())
                .mtfAlignmentScore(market.getMtfAlignmentScore())
                .extended(market.isExtended())
                .extendedState(market.getExtendedState())
                .freshness(market.getFreshness())
                .freshnessLabel(market.getFreshnessLabel())
                .rankScore(market.getRankScore())
                .regimeAligned(market.isRegimeAligned())
                .optionsWarnings(market.getOptionsWarnings())
                .build();
        symbolEnrichmentCache.put(row.getSymbol(), dto);
        return dto;
    }

    /** @deprecated use GET /api/symbols */
    public List<WatchlistItemDto> getWatchlist() {
        return getEnrichedSymbols().stream().map(this::toWatchlistItem).toList();
    }

    /** @deprecated use POST /api/symbols */
    public WatchlistItemDto addWatchlistSymbol(String symbol) {
        CreateTradingSymbolRequest req = new CreateTradingSymbolRequest();
        req.setSymbol(symbol);
        req.setGroupName("Momentum");
        req.setScanEnabled(true);
        req.setSubscribeLive(true);
        req.setPreloadOnStartup(true);
        req.setEnabled(true);
        TradingSymbol row = tradingSymbolService.createSymbol(req);
        return toWatchlistItem(enrichSymbol(row));
    }

    /** @deprecated use DELETE /api/symbols/{symbol} */
    public void removeWatchlistSymbol(String symbol) {
        tradingSymbolService.softDelete(symbol);
    }

    /** @deprecated use POST /api/symbols/{symbol}/view */
    public void recordWatchlistView(String symbol) {
        tradingSymbolService.recordLastViewed(symbol);
        symbolContextRegistry.touch(symbol.toUpperCase());
    }

    private WatchlistItemDto toWatchlistItem(TradingSymbolDto dto) {
        return WatchlistItemDto.builder()
                .symbol(dto.getSymbol())
                .source("USER")
                .active(dto.isActive())
                .pinned(dto.isPinned())
                .isDefault(false)
                .isCustom(true)
                .price(dto.getPrice())
                .trend(dto.getTrend())
                .trendIcon(dto.getTrendIcon())
                .relativeVolume(dto.getRelativeVolume())
                .signalState(dto.getSignalState())
                .lifecycleState(dto.getLifecycleState())
                .momentumState(dto.getMomentumState())
                .readinessState(dto.getReadinessState())
                .openReadinessState(dto.getOpenReadinessState())
                .gapPercent(dto.getGapPercent())
                .confidenceScore(dto.getConfidenceScore())
                .confidenceLabel(dto.getConfidenceLabel())
                .highRvol(dto.isHighRvol())
                .historicalLoaded(dto.isHistoricalLoaded())
                .liveSubscribed(dto.isLiveSubscribed())
                .sparkline(dto.getSparkline())
                .trend5m(dto.getTrend5m())
                .trend15m(dto.getTrend15m())
                .trend1h(dto.getTrend1h())
                .mtfSummary(dto.getMtfSummary())
                .mtfAlignmentScore(dto.getMtfAlignmentScore())
                .extended(dto.isExtended())
                .extendedState(dto.getExtendedState())
                .freshness(dto.getFreshness())
                .freshnessLabel(dto.getFreshnessLabel())
                .rankScore(dto.getRankScore())
                .regimeAligned(dto.isRegimeAligned())
                .optionsWarnings(dto.getOptionsWarnings())
                .build();
    }

    public SystemStatusDto getSystemStatus() {
        return getSystemStatus(ibkrProperties.getSymbol());
    }

    public SystemStatusDto getSystemStatus(String symbol) {
        Double livePrice = ibkrClientService.getLastPrice(symbol);
        if (livePrice == null) {
            livePrice = candleRepository
                    .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, tradingProperties.getTimeframe())
                    .stream()
                    .max(Comparator.comparing(Candle::getOpenTime))
                    .map(c -> c.getClose().doubleValue())
                    .orElse(null);
        }

        return SystemStatusDto.builder()
                .ibkrConnected(ibkrClientService.isConnected())
                .historicalLoaded(tradingPipelineService.isLiveSignalsEnabled())
                .liveStreaming(ibkrClientService.isLiveStreaming())
                .marketOpen(marketHoursService.isMarketOpen())
                .marketStatus(marketHoursService.getMarketStatus())
                .symbol(symbol)
                .livePrice(livePrice)
                .lastUpdate(MarketTime.formatIsoNow())
                .build();
    }

    public SignalHealthDto getSignalHealth() {
        List<EngineWindowDto> engines = List.of(
                EngineWindowDto.builder()
                        .code("OPEN_SCOUT")
                        .label("Open Scout")
                        .windowEt("9:30 – 9:40")
                        .triggerMode("Live ticks + 3s sweep")
                        .activeNow(marketHoursService.isOpenScoutWindow())
                        .build(),
                EngineWindowDto.builder()
                        .code("OPEN_MOM_BUY")
                        .label("Open Momentum Buy")
                        .windowEt("9:30 – 9:45")
                        .triggerMode("5m candle close")
                        .activeNow(marketHoursService.isOpenMomentumWindow())
                        .build(),
                EngineWindowDto.builder()
                        .code("OPEN_FAIL")
                        .label("Open Fail (PUT setup)")
                        .windowEt("9:35 – 11:00")
                        .triggerMode("5m candle close")
                        .activeNow(marketHoursService.isOpenFailWindow())
                        .build(),
                EngineWindowDto.builder()
                        .code("RECOVERY_FAIL")
                        .label("Recovery Fail (PUT setup)")
                        .windowEt("10:30 – 15:00")
                        .triggerMode("5m candle close + confirm")
                        .activeNow(marketHoursService.isRecoveryFailWindow())
                        .build(),
                EngineWindowDto.builder()
                        .code("MOM_PULL_CONT")
                        .label("MOM / PULL / CONT")
                        .windowEt("9:35 – 15:30")
                        .triggerMode("5m candle close")
                        .activeNow(marketHoursService.isMarketOpen())
                        .build()
        );

        return SignalHealthDto.builder()
                .ibkrConnected(ibkrClientService.isConnected())
                .historicalLoaded(tradingPipelineService.isLiveSignalsEnabled())
                .liveStreaming(ibkrClientService.isLiveStreaming())
                .liveSignalsEnabled(tradingPipelineService.isLiveSignalsEnabled())
                .marketStatus(marketHoursService.getMarketStatus())
                .marketOpen(marketHoursService.isMarketOpen())
                .estTime(marketHoursService.formatEstNow())
                .engines(engines)
                .build();
    }

    public DebugDto getDebugPanel() {
        return getDebugPanel(ibkrProperties.getSymbol());
    }

    public DebugDto getDebugPanel(String symbol) {
        String timeframe = tradingProperties.getTimeframe();
        List<Candle> candles = loadSessionCandles(symbol, timeframe);
        Candle last = candles.isEmpty() ? null : candles.get(candles.size() - 1);

        IndicatorResult indicators = indicatorCalculationService.calculateIndicators(candles);
        String indicatorSummary = indicators.isValid()
                ? String.format("EMA9=%.2f EMA20=%.2f RSI=%.1f MACD=%.3f VWAP=%.2f RelVol=%.2fx",
                indicators.getEma9(), indicators.getEma20(), indicators.getRsi(),
                indicators.getMacd(), indicators.getVwap(), indicators.getRelativeVolume())
                : "Insufficient candle data";

        TradingSignal lastSignal = tradingSignalRepository.findAll().stream()
                .filter(s -> symbol.equalsIgnoreCase(s.getSymbol()))
                .max(Comparator.comparing(TradingSignal::getTimestamp))
                .orElse(null);

        return DebugDto.builder()
                .lastCandleTime(last != null ? MarketTime.formatIso(last.getOpenTime()) : null)
                .lastCandleClose(last != null ? last.getClose().doubleValue() : null)
                .lastCandleVolume(last != null ? last.getVolume() : null)
                .latestIndicators(indicatorSummary)
                .latestSignalReason(signalEngineService.getLastSignalReason())
                .lastSignalType(lastSignal != null ? lastSignal.getSignalType() : null)
                .lifecycleState(lastSignal != null ? lastSignal.getLifecycleState() : null)
                .connectionLogs(ibkrClientService.getConnectionLogs())
                .cacheMetrics(symbolContextRegistry.cacheMetrics(subscriptionManager.subscriptionCount()))
                .marketTrend(marketTrendService.getMarketTrend())
                .build();
    }

    private WatchlistItemDto buildWatchlistItem(String symbol) {
        String sym = symbol.toUpperCase();
        IndicatorDto indicators = getLatestIndicators(sym);
        Double price = indicators.getEma9() > 0
                ? resolvePrice(sym, indicators)
                : null;
        String trend = resolveTrend(indicators);
        SymbolContext ctx = symbolContextRegistry.get(sym);
        TradingSignal latestSignal = findLatestActiveSignal(sym);
        String signalState = latestSignal != null ? latestSignal.getSignalType() : "NONE";
        String lifecycle = latestSignal != null && latestSignal.getLifecycleState() != null
                ? latestSignal.getLifecycleState() : "NONE";
        Integer score = latestSignal != null ? latestSignal.getConfidenceScore() : null;
        double rvol = indicators.getRelativeVolume() > 0 ? indicators.getRelativeVolume() : 0;
        WatchlistItemDto base = WatchlistItemDto.builder()
                .symbol(sym)
                .source(null)
                .active(true)
                .pinned(false)
                .isDefault(false)
                .isCustom(false)
                .price(price)
                .trend(trend)
                .trendIcon(trendIcon(trend))
                .relativeVolume(rvol > 0 ? rvol : null)
                .signalState(signalState)
                .lifecycleState(lifecycle)
                .momentumState(resolveMomentumState(signalState, lifecycle, ctx))
                .readinessState(ctx != null ? ctx.getReadinessState() : "")
                .openReadinessState(ctx != null ? ctx.getOpenReadinessState() : "")
                .gapPercent(ctx != null ? ctx.getGapPercent() : null)
                .confidenceScore(score)
                .confidenceLabel(confidenceLabel(score))
                .highRvol(rvol > 2.0)
                .historicalLoaded(ctx != null && ctx.isHistoricalLoaded())
                .liveSubscribed(subscriptionManager.isSubscribed(sym))
                .sparkline(buildSparkline(sym))
                .build();
        return intelligenceEnrichmentService.enrichWatchlist(base, latestSignal);
    }

    private TradingSignal findLatestActiveSignal(String symbol) {
        LocalDateTime since = MarketTime.nowLocal().minusMinutes(tradingProperties.getActiveSignalMinutes());
        return tradingSignalRepository.findByTimestampAfterOrderByTimestampDesc(since).stream()
                .filter(s -> symbol.equalsIgnoreCase(s.getSymbol()))
                .findFirst()
                .orElse(null);
    }

    private String resolveMomentumState(String signalState, String lifecycle, SymbolContext ctx) {
        if ("EXIT".equals(signalState) || "EXITED".equals(lifecycle)) {
            return "EXIT";
        }
        if ("MOM_BUY".equals(signalState)) {
            return "MOM";
        }
        if ("PULL_BUY".equals(signalState)) {
            return "PULL";
        }
        if ("CONT_BUY".equals(signalState)) {
            return "CONT";
        }
        if ("OPEN_MOM_BUY".equals(signalState)) {
            return "OPEN";
        }
        if ("OPEN_FAIL".equals(signalState) || "OPEN_FAIL_BREAK".equals(signalState)
                || RecoveryFailSignalService.RECOVERY_FAIL.equals(signalState)
                || ImbalanceSignalService.IMBALANCE_DOWN.equals(signalState)) {
            return "FAIL";
        }
        if (ctx != null && RecoveryFailEvaluator.READINESS_RECOVERY_FAIL_READY.equals(ctx.getReadinessState())) {
            return "RECOVERY_READY";
        }
        if (ctx != null && OpenFailEvaluator.READINESS_OPEN_FAIL_READY.equals(ctx.getOpenReadinessState())) {
            return "FAIL_READY";
        }
        if (ctx != null && OpenMomentumEvaluator.READINESS_OPEN_READY.equals(ctx.getOpenReadinessState())) {
            return "OPEN_READY";
        }
        if ("OPEN_SCOUT".equals(signalState)
                || (ctx != null && ctx.isOpenScoutActive() && !ctx.isOpenScoutFailed())) {
            return "SCOUT";
        }
        if (ctx != null && ContinuationBuyEvaluator.READINESS_CONT_READY.equals(ctx.getReadinessState())) {
            return "CONT_READY";
        }
        return "";
    }

    private List<Double> buildSparkline(String symbol) {
        List<Candle> candles = loadSessionCandles(symbol, tradingProperties.getTimeframe());
        int from = Math.max(0, candles.size() - 12);
        return candles.subList(from, candles.size()).stream()
                .map(c -> c.getClose().doubleValue())
                .toList();
    }

    private Double resolvePrice(String symbol, IndicatorDto indicators) {
        Double live = ibkrClientService.getLastPrice(symbol);
        if (live != null) {
            return live;
        }
        return candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, tradingProperties.getTimeframe())
                .stream()
                .max(Comparator.comparing(Candle::getOpenTime))
                .map(c -> c.getClose().doubleValue())
                .orElse(indicators.getVwap() > 0 ? indicators.getVwap() : null);
    }

    private String resolveTrend(IndicatorDto i) {
        if (i.getEma9() > i.getEma20() && i.getEma20() > i.getEma50()) {
            return "bullish";
        }
        if (i.getEma9() < i.getEma20() && i.getEma20() < i.getEma50()) {
            return "bearish";
        }
        return "neutral";
    }

    private String trendIcon(String trend) {
        return switch (trend) {
            case "bullish" -> "↑";
            case "bearish" -> "↓";
            default -> "→";
        };
    }

    private List<Candle> loadSessionCandles(String symbol, String timeframe) {
        return candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, timeframe)
                .stream()
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .toList();
    }

    private IndicatorDto toDto(IndicatorResult result) {
        return IndicatorDto.builder()
                .ema9(result.getEma9().doubleValue())
                .ema20(result.getEma20().doubleValue())
                .ema50(result.getEma50().doubleValue())
                .rsi(result.getRsi().doubleValue())
                .macd(result.getMacd().doubleValue())
                .signalLine(result.getSignalLine().doubleValue())
                .vwap(result.getVwap().doubleValue())
                .avgVolume(result.getAvgVolume())
                .relativeVolume(result.getRelativeVolume() != null ? result.getRelativeVolume().doubleValue() : 0)
                .timestamp(MarketTime.formatIsoNow())
                .build();
    }

    private IndicatorDto toDto(IndicatorSnapshot s) {
        return IndicatorDto.builder()
                .ema9(s.getEma9() != null ? s.getEma9().doubleValue() : 0)
                .ema20(s.getEma20() != null ? s.getEma20().doubleValue() : 0)
                .ema50(s.getEma50() != null ? s.getEma50().doubleValue() : 0)
                .rsi(s.getRsi() != null ? s.getRsi().doubleValue() : 0)
                .macd(s.getMacd() != null ? s.getMacd().doubleValue() : 0)
                .signalLine(s.getSignalLine() != null ? s.getSignalLine().doubleValue() : 0)
                .vwap(s.getVwap() != null ? s.getVwap().doubleValue() : 0)
                .avgVolume(s.getAvgVolume() != null ? s.getAvgVolume() : 0)
                .relativeVolume(s.getRelativeVolume() != null ? s.getRelativeVolume().doubleValue() : 0)
                .timestamp(MarketTime.formatIso(s.getTimestamp()))
                .build();
    }

    private IndicatorDto emptyIndicatorDto() {
        return IndicatorDto.builder()
                .ema9(0).ema20(0).ema50(0).rsi(0).macd(0).signalLine(0).vwap(0).avgVolume(0).relativeVolume(0)
                .timestamp(MarketTime.formatIsoNow())
                .build();
    }

    private ActiveSignalDto toActiveSignalDto(TradingSignal s) {
        IndicatorDto ind = getLatestIndicators(s.getSymbol());
        return ActiveSignalDto.builder()
                .symbol(s.getSymbol())
                .signalType(s.getSignalType())
                .price(s.getPrice().doubleValue())
                .rsi(s.getRsi() != null ? s.getRsi().doubleValue() : null)
                .relativeVolume(s.getRelativeVolume() != null ? s.getRelativeVolume().doubleValue() : null)
                .timestamp(MarketTime.formatIso(s.getTimestamp()))
                .confidenceScore(s.getConfidenceScore())
                .confidenceLabel(confidenceLabel(s.getConfidenceScore()))
                .lifecycleState(s.getLifecycleState())
                .trend(resolveTrend(ind))
                .signalReasons(SignalEngineService.parseReasons(s.getSignalReasons()))
                .build();
    }

    private OpeningMomentumDto toOpeningMomentumDto(TradingSignal s) {
        SymbolContext ctx = symbolContextRegistry.get(s.getSymbol());
        String label = confidenceLabel(s.getConfidenceScore());
        if (OpenScoutSignalService.OPEN_SCOUT.equals(s.getSignalType())) {
            label = s.getConfidenceScore() != null && s.getConfidenceScore() >= 2
                    ? "EARLY SIGNAL" : label;
        }
        return OpeningMomentumDto.builder()
                .symbol(s.getSymbol())
                .gapPercent(ctx != null ? ctx.getGapPercent() : null)
                .relativeVolume(s.getRelativeVolume() != null ? s.getRelativeVolume().doubleValue() : null)
                .confidenceScore(s.getConfidenceScore())
                .confidenceLabel(label)
                .signalType(s.getSignalType())
                .lifecycleState(s.getLifecycleState())
                .signalReasons(SignalEngineService.parseReasons(s.getSignalReasons()))
                .build();
    }

    private ReplayEventDto toReplayEventDto(SignalEvaluationSnapshot s) {
        return ReplayEventDto.builder()
                .symbol(s.getSymbol())
                .timestamp(s.getTimestamp().toString())
                .signalType(s.getSignalType())
                .lifecycleState(s.getLifecycleState())
                .score(s.getScore())
                .passedConditions(SignalEngineService.parseReasons(s.getPassedConditions()))
                .failedConditions(SignalEngineService.parseReasons(s.getFailedConditions()))
                .price(s.getPrice() != null ? s.getPrice().doubleValue() : null)
                .volume(s.getVolume())
                .rvol(s.getRvol() != null ? s.getRvol().doubleValue() : null)
                .vwapState(s.getVwapState())
                .build();
    }

    private List<HotMomentumDto> enrichAndRankHot(List<TradingSignal> signals, int limit) {
        List<HotMomentumDto> enriched = new ArrayList<>();
        for (TradingSignal s : signals) {
            enriched.add(intelligenceEnrichmentService.enrichHot(toHotMomentumDto(s), s, 0));
        }
        enriched.sort(Comparator.comparing(
                HotMomentumDto::getRankScore, Comparator.nullsLast(Comparator.reverseOrder())));
        List<HotMomentumDto> ranked = new ArrayList<>();
        int rank = 1;
        for (HotMomentumDto dto : enriched.stream().limit(limit).toList()) {
            ranked.add(dto.toBuilder().rank(rank++).build());
        }
        return ranked;
    }

    private HotMomentumDto toHotMomentumDto(TradingSignal s) {
        IndicatorDto ind = getLatestIndicators(s.getSymbol());
        return HotMomentumDto.builder()
                .symbol(s.getSymbol())
                .confidenceScore(s.getConfidenceScore())
                .confidenceLabel(confidenceLabel(s.getConfidenceScore()))
                .relativeVolume(s.getRelativeVolume() != null ? s.getRelativeVolume().doubleValue() : null)
                .trend(resolveTrend(ind))
                .signalType(s.getSignalType())
                .lifecycleState(s.getLifecycleState())
                .signalReasons(SignalEngineService.parseReasons(s.getSignalReasons()))
                .build();
    }

    private SignalDto toSignalDto(TradingSignal s) {
        Integer score = s.getConfidenceScore();
        return SignalDto.builder()
                .symbol(s.getSymbol())
                .signalType(s.getSignalType())
                .price(s.getPrice().doubleValue())
                .timestamp(MarketTime.formatIso(s.getTimestamp()))
                .rsi(s.getRsi() != null ? s.getRsi().doubleValue() : null)
                .macd(s.getMacd() != null ? s.getMacd().doubleValue() : null)
                .vwap(s.getVwap() != null ? s.getVwap().doubleValue() : null)
                .relativeVolume(s.getRelativeVolume() != null ? s.getRelativeVolume().doubleValue() : null)
                .confidenceScore(score)
                .confidenceLabel(confidenceLabel(score))
                .signalReason(s.getSignalReason())
                .lifecycleState(s.getLifecycleState())
                .signalReasons(SignalEngineService.parseReasons(s.getSignalReasons()))
                .build();
    }

    private String confidenceLabel(Integer score) {
        if (score == null || score == 0) {
            return "WEAK";
        }
        if (score >= 6) {
            return "ELITE";
        }
        if (score >= 4) {
            return "STRONG";
        }
        if (score >= 2) {
            return "GOOD";
        }
        return "WEAK";
    }

    private List<CandleChartDto> enrichWithIndicators(List<Candle> candles) {
        int barMinutes = tradingProperties.getCandleMinutes();
        BarSeries series = new BaseBarSeriesBuilder().withName("chart").build();

        for (Candle candle : candles) {
            ZonedDateTime end = MarketTime.toMarketZoned(candle.getCloseTime());
            series.addBar(
                    Duration.ofMinutes(barMinutes),
                    end,
                    candle.getOpen().doubleValue(),
                    candle.getHigh().doubleValue(),
                    candle.getLow().doubleValue(),
                    candle.getClose().doubleValue(),
                    candle.getVolume() != null ? candle.getVolume().doubleValue() : 0
            );
        }

        ClosePriceIndicator close = new ClosePriceIndicator(series);
        EMAIndicator ema9 = new EMAIndicator(close, 9);
        EMAIndicator ema20 = new EMAIndicator(close, 20);
        EMAIndicator ema50 = new EMAIndicator(close, 50);

        List<CandleChartDto> result = new ArrayList<>();
        double cumPv = 0;
        double cumVol = 0;
        LocalDate vwapDay = null;

        for (int i = 0; i < candles.size(); i++) {
            Candle c = candles.get(i);
            LocalDate barDay = MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate();
            if (!barDay.equals(vwapDay)) {
                vwapDay = barDay;
                cumPv = 0;
                cumVol = 0;
            }
            double vol = c.getVolume() != null ? c.getVolume().doubleValue() : 0;
            double typical = (c.getHigh().doubleValue() + c.getLow().doubleValue() + c.getClose().doubleValue()) / 3.0;
            if (vol > 0) {
                cumPv += typical * vol;
                cumVol += vol;
            }
            Double vwap = cumVol > 0 ? cumPv / cumVol : c.getClose().doubleValue();

            int idx = series.getBeginIndex() + i;
            result.add(CandleChartDto.builder()
                    .time(MarketTime.formatIso(c.getOpenTime()))
                    .open(c.getOpen().doubleValue())
                    .high(c.getHigh().doubleValue())
                    .low(c.getLow().doubleValue())
                    .close(c.getClose().doubleValue())
                    .volume(vol)
                    .ema9(idx >= 8 ? ema9.getValue(idx).doubleValue() : null)
                    .ema20(idx >= 19 ? ema20.getValue(idx).doubleValue() : null)
                    .ema50(idx >= 49 ? ema50.getValue(idx).doubleValue() : null)
                    .vwap(vwap)
                    .build());
        }
        return result;
    }
}
