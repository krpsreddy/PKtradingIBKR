package com.tradingbot.intelligence;

import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class NoEdgeService {

    public NoEdgeDto evaluate(MultiTimeframeDto mtf, MarketRegimeDto regime, RiskRewardDto rr,
                              SignalFreshnessDto freshness, ExtendedStateDto extended,
                              IndicatorResult indicators, SetupDeteriorationDto deterioration) {
        List<String> reasons = new ArrayList<>();
        boolean noEdge = false;

        if (regime != null && regime.isChoppy()) {
            reasons.add("Chop regime — momentum unreliable");
            noEdge = true;
        }

        if (indicators != null && indicators.getRelativeVolume() != null
                && indicators.getRelativeVolume().doubleValue() < 0.9) {
            reasons.add("Low RVOL — insufficient participation");
            noEdge = true;
        }

        if (freshness != null && ("STALE".equals(freshness.getFreshness()) || freshness.isStaleForOptions())) {
            reasons.add("Stale setup — edge likely gone");
            noEdge = true;
        }

        if (mtf != null && mtf.getAlignmentScore() < 40) {
            reasons.add("Conflicting MTF alignment");
            noEdge = true;
        }

        if (rr != null && "POOR".equals(rr.getQuality())) {
            reasons.add("Poor risk/reward");
            noEdge = true;
        }

        if (extended != null && extended.isExtended()
                && freshness != null && !"FRESH".equals(freshness.getFreshness())) {
            reasons.add("Extended + aging — avoid chasing");
            noEdge = true;
        }

        if (deterioration != null && "FAILING".equals(deterioration.getState())) {
            reasons.add("Setup failing");
            noEdge = true;
        }

        if (regime != null && "LOW_MOMENTUM".equals(regime.getRegime())) {
            reasons.add("Weak market breadth");
        }

        String message = noEdge
                ? (extended != null && extended.isExtended() ? "AVOID OPTIONS HERE" : "NO EDGE")
                : (reasons.isEmpty() ? null : "WAIT FOR CONFIRMATION");

        if (!noEdge && !reasons.isEmpty()) {
            message = "WAIT FOR CONFIRMATION";
        }

        return NoEdgeDto.builder()
                .noEdge(noEdge)
                .message(message)
                .reasons(reasons)
                .build();
    }

    public List<String> buildWhyNotReasons(NoEdgeDto noEdge, SymbolIntelligenceDto intel,
                                           RiskRewardDto rr, TradeQualityDto quality,
                                           SetupDeteriorationDto deterioration) {
        List<String> whyNot = new ArrayList<>();
        if (noEdge != null) whyNot.addAll(noEdge.getReasons());

        if (intel != null && !intel.isRegimeAligned()) {
            whyNot.add("Weak market regime alignment");
        }

        if (intel != null && intel.getMtf() != null) {
            String t1h = intel.getMtf().getTrend1h();
            if ("neutral".equals(t1h)) {
                whyNot.add("1h timeframe neutral");
            }
        }

        if (intel != null && intel.getExtended() != null && intel.getExtended().isExtended()) {
            whyNot.add("Slightly extended from mean");
        }

        if (intel != null && intel.getFreshness() != null && "AGING".equals(intel.getFreshness().getFreshness())) {
            whyNot.add("Aging signal");
        }

        if (deterioration != null && !"STABLE".equals(deterioration.getState())) {
            whyNot.add("Setup " + deterioration.getState().toLowerCase());
        }

        if (rr != null && "POOR".equals(rr.getQuality())) {
            whyNot.add("Poor RR (" + rr.getRiskRewardRatio() + ":1)");
        }

        if (quality != null && ("C".equals(quality.getGrade()) || "AVOID".equals(quality.getGrade()))) {
            whyNot.add("Trade quality " + quality.getGrade());
        }

        return whyNot.stream().distinct().toList();
    }
}
