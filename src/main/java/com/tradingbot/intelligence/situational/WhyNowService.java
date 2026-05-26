package com.tradingbot.intelligence.situational;

import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.WhyNowDto;
import com.tradingbot.intelligence.dto.SymbolIntelligenceDto;
import com.tradingbot.models.TradingSignal;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class WhyNowService {

    public WhyNowDto explain(String setupType, TradingSignal signal, SymbolIntelligenceDto intel,
                             MarketTrendDto trend) {
        List<String> reasons = new ArrayList<>();
        int conviction = 50;

        if (signal != null && signal.getRelativeVolume() != null) {
            double rvol = signal.getRelativeVolume().doubleValue();
            if (rvol >= 2.5) {
                reasons.add("RVOL spike — volume confirming move");
                conviction += 15;
            } else if (rvol >= 1.8) {
                reasons.add("Elevated relative volume");
                conviction += 8;
            }
        }

        if (intel != null && intel.getFreshness() != null) {
            String f = intel.getFreshness().getFreshness();
            if ("FRESH".equals(f)) {
                reasons.add("Fresh signal — edge window open");
                conviction += 12;
            } else if ("STALE".equals(f) || "AGING".equals(f)) {
                reasons.add("Setup aging — urgency declining");
                conviction -= 10;
            }
        }

        if (trend != null) {
            String regime = trend.getRegime();
            if (setupType != null && setupType.contains("CONT") && "TRENDING_BULL".equals(regime)) {
                reasons.add("Trend acceleration in bull regime");
                conviction += 10;
            }
            if (setupType != null && setupType.contains("OPEN") && "CHOPPY".equals(regime)) {
                reasons.add("Choppy regime — open momentum less reliable");
                conviction -= 12;
            }
            if (trend.getSemiBreadth() != null && trend.getSemiBreadth().toUpperCase().contains("STRONG")) {
                reasons.add("Sector breadth expanding");
                conviction += 8;
            }
            if (trend.getAiBreadth() != null && trend.getAiBreadth().toUpperCase().contains("STRONG")) {
                reasons.add("AI leadership breadth strong");
                conviction += 6;
            }
        }

        if (intel != null && intel.isRegimeAligned()) {
            reasons.add("Regime aligned with setup type");
            conviction += 8;
        }

        if (intel != null && intel.getMtf() != null && intel.getMtf().getAlignmentScore() >= 70) {
            reasons.add("Multi-timeframe trend acceleration");
            conviction += 6;
        }

        if (intel != null && intel.getExtended() != null && intel.getExtended().isExtended()) {
            reasons.add("Extended from VWAP — late entry risk");
            conviction -= 8;
        }

        conviction = Math.max(0, Math.min(100, conviction));
        String headline = reasons.isEmpty()
                ? "Monitor for confirmation"
                : reasons.get(0);

        return WhyNowDto.builder()
                .headline(headline)
                .reasons(reasons.stream().limit(4).toList())
                .convictionScore(conviction)
                .build();
    }
}
