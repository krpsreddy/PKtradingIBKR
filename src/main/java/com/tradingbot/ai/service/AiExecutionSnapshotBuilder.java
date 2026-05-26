package com.tradingbot.ai.service;

import com.tradingbot.ai.dto.AiDtos.AiExecutionRequestDto;
import com.tradingbot.api.DashboardService;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.OpeningMomentumDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.ProbabilisticExecutionSnapshotDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.TradeExpectancyDto;
import com.tradingbot.intelligence.IntelligenceEnrichmentService;
import com.tradingbot.intelligence.dto.SymbolIntelligenceDto;
import com.tradingbot.intelligence.probabilistic.ProbabilisticExecutionOrchestrator;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.repository.TradingSignalRepository;
import com.tradingbot.services.MarketTrendService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

/** Builds compressed AiExecutionRequest from deterministic engine snapshots. */
@Service
@RequiredArgsConstructor
public class AiExecutionSnapshotBuilder {

    private final ProbabilisticExecutionOrchestrator probabilisticOrchestrator;
    private final IntelligenceEnrichmentService enrichmentService;
    private final TradingSignalRepository signalRepository;
    private final MarketTrendService marketTrendService;
    private final DashboardService dashboardService;

    public AiExecutionRequestDto build(String symbol, String signalTypeOverride) {
        String sym = symbol == null ? "" : symbol.toUpperCase(Locale.ROOT);
        MarketTrendDto trend = marketTrendService.getMarketTrend();
        TradingSignal signal = sym.isBlank() ? null
                : signalRepository.findBySymbolOrderByTimestampDesc(sym).stream().findFirst().orElse(null);
        String signalType = signalTypeOverride != null && !signalTypeOverride.isBlank()
                ? signalTypeOverride
                : (signal != null ? signal.getSignalType() : "WATCH");

        SymbolIntelligenceDto intel = sym.isBlank() ? null : enrichmentService.analyze(sym, signal);
        ProbabilisticExecutionSnapshotDto prob = probabilisticOrchestrator.snapshot(sym, signalType);

        double rvol = signal != null && signal.getRelativeVolume() != null
                ? signal.getRelativeVolume().doubleValue() : 0;
        double trendAlign = intel != null && intel.getMtf() != null ? intel.getMtf().getAlignmentScore() : 0;
        double conviction = prob.getWhyNow() != null ? prob.getWhyNow().getConvictionScore() : 0;
        double premarketExt = resolvePremarketExtension(sym);
        double vwapDist = resolveVwapDistance(signal);
        TradeExpectancyDto exp = prob.getExpectancy();
        double winRate = exp != null && exp.getWinRate() != null ? exp.getWinRate() : 0;
        double expectancyR = exp != null && exp.getHistoricalExpectancyR() != null ? exp.getHistoricalExpectancyR() : 0;
        Double fakeout = prob.getFailureSignature() != null
                ? (double) prob.getFailureSignature().getFailureProbability() : null;

        return AiExecutionRequestDto.builder()
                .symbol(sym)
                .signalType(signalType)
                .marketRegime(trend != null ? trend.getRegime() : "UNKNOWN")
                .rvol(rvol)
                .trendAlignment(trendAlign)
                .convictionScore(conviction)
                .premarketExtension(premarketExt)
                .entryDistanceFromVWAP(vwapDist)
                .historicalWinRate(winRate)
                .expectancyR(expectancyR)
                .fakeoutRisk(fakeout)
                .currentState(mapState(signal, prob))
                .marketBreadth(buildBreadth(trend))
                .openType(resolveOpenType(signalType))
                .build();
    }

    private double resolvePremarketExtension(String sym) {
        return dashboardService.getOpeningMomentum().stream()
                .filter(o -> sym.equalsIgnoreCase(o.getSymbol()))
                .map(OpeningMomentumDto::getGapPercent)
                .filter(g -> g != null)
                .findFirst()
                .orElse(0.0);
    }

    private double resolveVwapDistance(TradingSignal signal) {
        if (signal == null || signal.getVwap() == null || signal.getPrice() == null) {
            return 0;
        }
        double vwap = signal.getVwap().doubleValue();
        double price = signal.getPrice().doubleValue();
        if (vwap == 0) return 0;
        return Math.abs((price - vwap) / vwap) * 100.0;
    }

    private String buildBreadth(MarketTrendDto trend) {
        if (trend == null) return "—";
        List<String> parts = new java.util.ArrayList<>();
        if (trend.getSemiBreadth() != null) parts.add(trend.getSemiBreadth());
        if (trend.getAiBreadth() != null) parts.add(trend.getAiBreadth());
        return parts.isEmpty() ? trend.getRegime() : String.join(" · ", parts);
    }

    private String resolveOpenType(String signalType) {
        if (signalType == null) return null;
        if (signalType.contains("OPEN")) return signalType;
        return null;
    }

    private String mapState(TradingSignal signal, ProbabilisticExecutionSnapshotDto prob) {
        if (prob.getAdaptiveExit() != null) {
            String state = prob.getAdaptiveExit().getState();
            if ("EXIT_NOW".equals(state) || "EXIT_SOON".equals(state)) return "EXITING";
        }
        if (signal == null) return "WATCHING";
        String life = signal.getLifecycleState();
        if (life != null) {
            String u = life.toUpperCase(Locale.ROOT);
            if (u.contains("EXIT")) return "EXITING";
            if (u.contains("TRIGGER") || u.contains("FIRED")) return "TRIGGERED";
            if (u.contains("READY")) return "READY";
            if (u.contains("MANAG")) return "MANAGING";
        }
        if (prob.getSetupMaturity() != null) {
            String stage = prob.getSetupMaturity().getStage();
            if ("TRIGGERED".equals(stage) || "CONFIRMED".equals(stage)) return "TRIGGERED";
            if ("FORMING".equals(stage) || "BUILDING".equals(stage)) return "WATCHING";
        }
        return "WATCHING";
    }
}
