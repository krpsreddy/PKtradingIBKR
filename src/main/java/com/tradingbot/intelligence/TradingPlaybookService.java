package com.tradingbot.intelligence;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.PlaybookDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.RegimePerformanceDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.intelligence.historical.SetupStatisticsService;
import com.tradingbot.intelligence.situational.ContextualPlaybookService;
import com.tradingbot.services.MarketTrendService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TradingPlaybookService {

    private final MarketMemoryService marketMemoryService;
    private final SetupStatisticsService setupStatisticsService;
    private final TradingProperties tradingProperties;
    private final ContextualPlaybookService contextualPlaybookService;
    private final MarketTrendService marketTrendService;

    public List<PlaybookDto> playbooks() {
        MarketMemoryDto memory = marketMemoryService.expandedMemory(tradingProperties.getIntelligenceLookbackDays());
        Map<String, Double> regimeRates = memory.getRegimeSetupWinRates() != null
                ? memory.getRegimeSetupWinRates() : Map.of();
        var hints = contextualPlaybookService.hints(marketTrendService.getMarketTrend(), memory, null);
        Map<String, String> statusById = new java.util.HashMap<>();
        Map<String, String> reasonById = new java.util.HashMap<>();
        for (var h : hints) {
            statusById.putIfAbsent(h.getPlaybookId(), h.getStatus());
            reasonById.putIfAbsent(h.getPlaybookId(), h.getReason());
        }

        return List.of(
                build("OPEN_MOM", "OPEN MOMENTUM",
                        List.of("Gap + RVOL > 2", "Above VWAP", "TRENDING_BULL regime", "FRESH entry"),
                        List.of("CHOPPY regime", "Extended from VWAP", "Stale signal"),
                        0.58, List.of("TRENDING_BULL", "RISK_ON"),
                        "First 30–45 min, on breakout confirmation", regimeRates,
                        statusById.get("OPEN_MOM"), reasonById.get("OPEN_MOM")),
                build("CONT", "CONTINUATION",
                        List.of("CONT_READY state", "MTF aligned", "Pullback to EMA9/VWAP"),
                        List.of("LOW_MOMENTUM", "Weakening RVOL", "Extended"),
                        0.62, List.of("TRENDING_BULL"),
                        "After consolidation, on volume return", regimeRates,
                        statusById.get("CONT"), reasonById.get("CONT")),
                build("VWAP_RECLAIM", "VWAP RECLAIM",
                        List.of("Lost VWAP then reclaimed", "RVOL increasing", "Not extended"),
                        List.of("Chop", "Low volume reclaim"),
                        0.52, List.of("RISK_ON"),
                        "On hold above VWAP with volume", regimeRates,
                        statusById.get("VWAP_RECLAIM"), reasonById.get("VWAP_RECLAIM")),
                build("OPEN_FAIL", "FAILED MOMENTUM",
                        List.of("OPEN_FAIL signal", "Bearish MTF", "Below VWAP"),
                        List.of("Bull regime reversal", "Oversold bounce risk"),
                        0.55, List.of("TRENDING_BEAR", "CHOPPY"),
                        "On fail confirmation, ATM puts", regimeRates,
                        statusById.get("OPEN_FAIL"), reasonById.get("OPEN_FAIL"))
        );
    }

    private PlaybookDto build(String id, String name, List<String> ideal, List<String> avoid,
                              double defaultWr, List<String> bestRegimes, String timing,
                              Map<String, Double> regimeRates, String contextualStatus, String contextualReason) {
        var stats = setupStatisticsService.statistics(id, tradingProperties.getIntelligenceLookbackDays());
        double wr = stats.getSampleSize() > 0 ? stats.getWinRate() : defaultWr;

        return PlaybookDto.builder()
                .id(id)
                .name(name)
                .idealConditions(ideal)
                .avoidConditions(avoid)
                .historicalWinRate(wr)
                .bestRegimes(bestRegimes)
                .entryTiming(timing)
                .regimePerformance(regimePerformance(id, regimeRates))
                .contextualStatus(contextualStatus)
                .contextualReason(contextualReason)
                .build();
    }

    private List<RegimePerformanceDto> regimePerformance(String setupId, Map<String, Double> regimeRates) {
        List<RegimePerformanceDto> list = new ArrayList<>();
        String[] regimes = {"TRENDING_BULL", "TRENDING_BEAR", "CHOPPY", "RISK_ON"};
        for (String regime : regimes) {
            Double wr = regimeRates.get(setupId + "|" + regime);
            if (wr == null) {
                wr = defaultRegimeWr(setupId, regime);
            }
            list.add(RegimePerformanceDto.builder()
                    .regime(regime)
                    .winRate(wr)
                    .label(labelFor(wr, setupId, regime))
                    .build());
        }
        return list;
    }

    private double defaultRegimeWr(String setupId, String regime) {
        if ("CONT".equals(setupId)) {
            return "TRENDING_BULL".equals(regime) ? 0.68 : "CHOPPY".equals(regime) ? 0.32 : 0.52;
        }
        if ("OPEN_MOM".equals(setupId)) {
            return "CHOPPY".equals(regime) ? 0.35 : "TRENDING_BULL".equals(regime) ? 0.62 : 0.48;
        }
        if ("OPEN_FAIL".equals(setupId)) {
            return "TRENDING_BEAR".equals(regime) || "CHOPPY".equals(regime) ? 0.58 : 0.38;
        }
        if ("VWAP_RECLAIM".equals(setupId)) {
            return "RISK_ON".equals(regime) ? 0.55 : 0.42;
        }
        return 0.5;
    }

    private String labelFor(double wr, String setupId, String regime) {
        if ("CONT".equals(setupId) && "TRENDING_BULL".equals(regime) && wr >= 0.6) return "EXCELLENT";
        if ("CONT".equals(setupId) && "CHOPPY".equals(regime) && wr < 0.4) return "TERRIBLE";
        if ("OPEN_FAIL".equals(setupId) && ("CHOPPY".equals(regime) || "TRENDING_BEAR".equals(regime)) && wr >= 0.5) return "GOOD";
        if (wr >= 0.6) return "EXCELLENT";
        if (wr >= 0.48) return "GOOD";
        if (wr >= 0.35) return "POOR";
        return "TERRIBLE";
    }
}
