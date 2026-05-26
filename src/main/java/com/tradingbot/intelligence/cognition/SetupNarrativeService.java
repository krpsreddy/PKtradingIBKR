package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.SetupNarrativeDto;
import com.tradingbot.intelligence.AdaptiveRankingService;
import com.tradingbot.intelligence.dto.ExecutionIntelligenceDto;
import com.tradingbot.intelligence.dto.SymbolIntelligenceDto;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.services.MarketTrendService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class SetupNarrativeService {

    private final MarketTrendService marketTrendService;
    private final AdaptiveRankingService adaptiveRankingService;

    public SetupNarrativeDto narrate(SymbolIntelligenceDto intel, TradingSignal signal) {
        if (intel == null) {
            return SetupNarrativeDto.builder()
                    .symbol("")
                    .narrative("Select a symbol with an active setup for AI narrative.")
                    .highlights(List.of())
                    .cautions(List.of())
                    .build();
        }

        String sym = intel.getSymbol();
        String signalType = signal != null ? signal.getSignalType() : "—";
        MarketTrendDto trend = marketTrendService.getMarketTrend();
        String regime = trend != null ? trend.getRegime() : "UNKNOWN";

        List<String> highlights = new ArrayList<>();
        List<String> cautions = new ArrayList<>();
        StringBuilder narrative = new StringBuilder();

        narrative.append(sym).append(" is showing ");
        narrative.append(humanSignal(signalType));

        if (intel.getMtf() != null && (intel.getMtf().isAlignedBullish() || intel.getMtf().isAlignedBearish())) {
            highlights.add("MTF aligned");
            narrative.append(" with multi-timeframe alignment");
        } else if (intel.getMtf() != null) {
            cautions.add("MTF not fully aligned");
        }

        if (signal != null && signal.getRelativeVolume() != null) {
            double rvol = signal.getRelativeVolume().doubleValue();
            if (rvol >= 2) {
                highlights.add("RVOL " + String.format(Locale.US, "%.1fx", rvol));
                narrative.append(" and elevated relative volume");
            } else if (rvol < 1.2) {
                cautions.add("Low RVOL — weak participation");
            }
        }

        if (trend != null) {
            if ("STRONG".equals(trend.getSemiBreadth()) || "STRONG".equals(trend.getAiBreadth())) {
                highlights.add("Semiconductor/AI breadth support");
                narrative.append(". Sector breadth is supportive");
            }
            if (trend.isChoppy()) {
                cautions.add("CHOPPY regime — reduce aggression");
            }
        }

        if (intel.isRegimeAligned()) {
            highlights.add("Regime aligned");
        } else {
            cautions.add("Setup misaligned with " + regime + " regime");
        }

        ExecutionIntelligenceDto exec = intel.getExecution();
        if (exec != null && exec.getDeterioration() != null
                && !"STABLE".equals(exec.getDeterioration().getState())) {
            cautions.add("Setup quality " + exec.getDeterioration().getState().toLowerCase(Locale.ROOT));
            narrative.append(". However, setup quality is deteriorating");
            if (!exec.getDeterioration().getReasons().isEmpty()) {
                narrative.append(" due to ").append(String.join(" and ", exec.getDeterioration().getReasons()));
            }
        }

        double wr = adaptiveRankingService.winRate(signalType, regime);
        if (wr >= 0) {
            narrative.append(String.format(Locale.US, ". Historical win rate in %s: %.0f%%", regime, wr));
        }

        narrative.append(".");

        if (!highlights.isEmpty() && !cautions.isEmpty()) {
            narrative.append(" Weigh sector support against current deterioration signals.");
        }

        return SetupNarrativeDto.builder()
                .symbol(sym)
                .signalType(signalType)
                .narrative(narrative.toString())
                .highlights(highlights)
                .cautions(cautions)
                .build();
    }

    private String humanSignal(String signalType) {
        if (signalType == null) return "no active signal";
        return switch (signalType) {
            case "OPEN_MOM_BUY", "OPEN_SCOUT" -> "opening momentum";
            case "CONT_BUY", "CONT_READY" -> "continuation strength";
            case "OPEN_FAIL", "OPEN_FAIL_BREAK" -> "failed momentum (bearish)";
            case "MOM_BUY" -> "intraday momentum";
            default -> signalType.replace('_', ' ').toLowerCase(Locale.ROOT);
        };
    }
}
