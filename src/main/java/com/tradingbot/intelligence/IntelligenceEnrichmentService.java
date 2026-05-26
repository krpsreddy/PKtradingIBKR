package com.tradingbot.intelligence;

import com.tradingbot.api.dto.ActiveSignalDto;
import com.tradingbot.api.dto.HotMomentumDto;
import com.tradingbot.api.dto.OpeningMomentumDto;
import com.tradingbot.api.dto.ExecutionSnapshotDto;
import com.tradingbot.api.dto.SignalDto;
import com.tradingbot.api.dto.WatchlistItemDto;
import com.tradingbot.indicators.IndicatorCalculationService;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.SymbolIntelligenceDto;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.repository.CandleRepository;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import com.tradingbot.config.TradingProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IntelligenceEnrichmentService {

    private final IntradayIntelligenceService intradayIntelligenceService;
    private final IndicatorCalculationService indicatorCalculationService;
    private final CandleRepository candleRepository;
    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;

    public SymbolIntelligenceDto analyze(String symbol, TradingSignal signal) {
        IndicatorResult indicators = loadIndicators(symbol);
        return intradayIntelligenceService.analyzeSymbol(symbol, indicators, signal);
    }

    public WatchlistItemDto enrichWatchlist(WatchlistItemDto base, TradingSignal latestSignal) {
        SymbolIntelligenceDto intel = analyze(base.getSymbol(), latestSignal);
        return base.toBuilder()
                .trend5m(intel.getMtf().getTrend5m())
                .trend15m(intel.getMtf().getTrend15m())
                .trend1h(intel.getMtf().getTrend1h())
                .mtfSummary(intel.getMtf().getSummary())
                .mtfAlignmentScore(intel.getMtf().getAlignmentScore())
                .extended(intel.getExtended().isExtended())
                .extendedState(intel.getExtended().getState())
                .freshness(intel.getFreshness().getFreshness())
                .freshnessLabel(intel.getFreshness().getAgeLabel())
                .rankScore(intel.getRank().getRankScore())
                .regimeAligned(intel.isRegimeAligned())
                .optionsWarnings(mergeWarnings(intel))
                .build();
    }

    public HotMomentumDto enrichHot(HotMomentumDto base, TradingSignal signal, int rank) {
        SymbolIntelligenceDto intel = analyze(signal.getSymbol(), signal);
        return base.toBuilder()
                .timestamp(signal.getTimestamp() != null ? MarketTime.formatIso(signal.getTimestamp()) : null)
                .rankScore(intel.getRank().getRankScore())
                .rank(rank)
                .mtfSummary(intel.getMtf().getSummary())
                .freshness(intel.getFreshness().getFreshness())
                .freshnessLabel(intel.getFreshness().getAgeLabel())
                .extended(intel.getExtended().isExtended())
                .extendedState(intel.getExtended().getState())
                .optionsWarnings(mergeWarnings(intel))
                .build();
    }

    public OpeningMomentumDto enrichOpening(OpeningMomentumDto base, TradingSignal signal, int rank) {
        if (signal == null) {
            return base.toBuilder().rank(rank).build();
        }
        SymbolIntelligenceDto intel = analyze(signal.getSymbol(), signal);
        return base.toBuilder()
                .rankScore(intel.getRank().getRankScore())
                .rank(rank)
                .mtfSummary(intel.getMtf().getSummary())
                .freshness(intel.getFreshness().getFreshness())
                .freshnessLabel(intel.getFreshness().getAgeLabel())
                .extended(intel.getExtended().isExtended())
                .optionsWarnings(mergeWarnings(intel))
                .build();
    }

    public ActiveSignalDto enrichActive(ActiveSignalDto base, TradingSignal signal) {
        SymbolIntelligenceDto intel = analyze(signal.getSymbol(), signal);
        ActiveSignalDto.ActiveSignalDtoBuilder b = base.toBuilder()
                .rankScore(intel.getRank().getRankScore())
                .mtfSummary(intel.getMtf().getSummary())
                .freshness(intel.getFreshness().getFreshness())
                .freshnessLabel(intel.getFreshness().getAgeLabel())
                .extended(intel.getExtended().isExtended())
                .optionsWarnings(mergeWarnings(intel));
        applyExecution(b, intel);
        return b.build();
    }

    public ExecutionSnapshotDto toExecutionSnapshot(SymbolIntelligenceDto intel) {
        if (intel.getExecution() == null) {
            return ExecutionSnapshotDto.builder().symbol(intel.getSymbol()).build();
        }
        var ex = intel.getExecution();
        var rr = ex.getRiskReward();
        var tq = ex.getTradeQuality();
        var det = ex.getDeterioration();
        var ne = ex.getNoEdge();
        return ExecutionSnapshotDto.builder()
                .symbol(intel.getSymbol())
                .estimatedRr(rr != null ? rr.getRiskRewardRatio() : null)
                .rrQuality(rr != null ? rr.getQuality() : null)
                .entryPrice(rr != null ? rr.getEntryPrice() : null)
                .stopZone(rr != null ? rr.getStopZone() : null)
                .invalidationLevel(rr != null ? rr.getInvalidationLevel() : null)
                .targetPrice(rr != null ? rr.getTargetPrice() : null)
                .tradeQualityGrade(tq != null ? tq.getGrade() : null)
                .tradeQualityScore(tq != null ? tq.getScore() : null)
                .deteriorationState(det != null ? det.getState() : null)
                .deteriorationReasons(det != null ? det.getReasons() : List.of())
                .noEdge(ne != null && ne.isNoEdge())
                .noEdgeMessage(ne != null ? ne.getMessage() : null)
                .whyNotReasons(ex.getWhyNotReasons())
                .optionsGuidance(ex.getOptionsGuidance())
                .optionsWarnings(ex.getOptionsWarnings())
                .alertPriority(ex.getAlertPriority())
                .build();
    }

    private void applyExecution(ActiveSignalDto.ActiveSignalDtoBuilder b, SymbolIntelligenceDto intel) {
        if (intel.getExecution() == null) return;
        var ex = intel.getExecution();
        var rr = ex.getRiskReward();
        var tq = ex.getTradeQuality();
        var det = ex.getDeterioration();
        var ne = ex.getNoEdge();
        b.estimatedRr(rr != null ? rr.getRiskRewardRatio() : null)
                .rrQuality(rr != null ? rr.getQuality() : null)
                .tradeQualityGrade(tq != null ? tq.getGrade() : null)
                .tradeQualityScore(tq != null ? tq.getScore() : null)
                .deteriorationState(det != null ? det.getState() : null)
                .deteriorationReasons(det != null ? det.getReasons() : null)
                .noEdge(ne != null && ne.isNoEdge())
                .noEdgeMessage(ne != null ? ne.getMessage() : null)
                .whyNotReasons(ex.getWhyNotReasons())
                .alertPriority(ex.getAlertPriority());
    }

    public SignalDto enrichSignal(SignalDto base, TradingSignal signal) {
        SymbolIntelligenceDto intel = analyze(signal.getSymbol(), signal);
        return base.toBuilder()
                .rankScore(intel.getRank().getRankScore())
                .mtfSummary(intel.getMtf().getSummary())
                .freshness(intel.getFreshness().getFreshness())
                .freshnessLabel(intel.getFreshness().getAgeLabel())
                .extended(intel.getExtended().isExtended())
                .optionsWarnings(mergeWarnings(intel))
                .build();
    }

    public List<String> mergeWarnings(SymbolIntelligenceDto intel) {
        List<String> warnings = new ArrayList<>(intel.getRank().getOptionsWarnings());
        if (intel.getExtended().isExtended() && intel.getExtended().getOptionsWarning() != null
                && !warnings.contains(intel.getExtended().getOptionsWarning())) {
            warnings.add(intel.getExtended().getOptionsWarning());
        }
        if (intel.getFreshness().isStaleForOptions()
                && !warnings.contains("Signal stale for options")) {
            warnings.add("Signal stale for options");
        }
        if ("CHOPPY".equals(intel.getRegimeImpact()) && !warnings.contains("High chop risk for options")) {
            warnings.add("High chop risk for options");
        }
        return warnings.stream().distinct().collect(Collectors.toList());
    }

    private IndicatorResult loadIndicators(String symbol) {
        var candles = candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, tradingProperties.getTimeframe())
                .stream()
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .sorted(Comparator.comparing(com.tradingbot.models.Candle::getOpenTime))
                .toList();
        if (candles.size() < tradingProperties.getMinCandlesForSignals()) {
            return IndicatorResult.builder().valid(false).build();
        }
        return indicatorCalculationService.calculateIndicators(candles);
    }
}
