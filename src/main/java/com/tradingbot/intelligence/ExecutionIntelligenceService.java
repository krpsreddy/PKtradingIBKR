package com.tradingbot.intelligence;

import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.*;
import com.tradingbot.models.TradingSignal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExecutionIntelligenceService {

    private final RiskRewardService riskRewardService;
    private final TradeQualityService tradeQualityService;
    private final SetupDeteriorationService setupDeteriorationService;
    private final NoEdgeService noEdgeService;

    public ExecutionIntelligenceDto analyze(SymbolIntelligenceDto intel, IndicatorResult indicators,
                                            TradingSignal signal, List<com.tradingbot.models.Candle> session) {
        boolean bullish = signal == null || SignalRankingEngine.isBullishSignalType(signal.getSignalType());

        RiskRewardDto rr = riskRewardService.calculate(indicators, signal, bullish);
        TradeQualityDto quality = tradeQualityService.grade(intel, rr, indicators, signal);
        SetupDeteriorationDto deterioration = setupDeteriorationService.analyze(indicators, signal, session);
        NoEdgeDto noEdge = noEdgeService.evaluate(
                intel.getMtf(), toRegime(intel), rr, intel.getFreshness(), intel.getExtended(),
                indicators, deterioration);

        List<String> whyNot = noEdgeService.buildWhyNotReasons(noEdge, intel, rr, quality, deterioration);
        String optionsGuidance = buildOptionsGuidance(bullish, quality, rr);
        List<String> optionsWarnings = buildOptionsWarnings(intel, rr, quality, noEdge);
        String alertPriority = computeAlertPriority(intel, rr, quality, noEdge);

        return ExecutionIntelligenceDto.builder()
                .riskReward(rr)
                .tradeQuality(quality)
                .deterioration(deterioration)
                .noEdge(noEdge)
                .whyNotReasons(whyNot)
                .optionsGuidance(optionsGuidance)
                .optionsWarnings(optionsWarnings)
                .alertPriority(alertPriority)
                .build();
    }

    public boolean shouldSendTelegramAlert(ExecutionIntelligenceDto exec) {
        if (exec == null) return true;
        if (exec.getNoEdge() != null && exec.getNoEdge().isNoEdge()) return false;
        return "HIGH".equals(exec.getAlertPriority());
    }

    private MarketRegimeDto toRegime(SymbolIntelligenceDto intel) {
        return MarketRegimeDto.builder()
                .regime(intel.getRegimeImpact())
                .choppy("CHOPPY".equals(intel.getRegimeImpact()))
                .build();
    }

    private String buildOptionsGuidance(boolean bullish, TradeQualityDto quality, RiskRewardDto rr) {
        if ("AVOID".equals(quality.getGrade())) {
            return "Avoid options — wait for better setup";
        }
        if (bullish) {
            return "ATM weekly · Slightly ITM · Delta ~0.60+";
        }
        return "ATM PUT · Avoid illiquid strikes";
    }

    private List<String> buildOptionsWarnings(SymbolIntelligenceDto intel, RiskRewardDto rr,
                                              TradeQualityDto quality, NoEdgeDto noEdge) {
        List<String> warnings = new ArrayList<>();
        if (intel.getExtended() != null && intel.getExtended().isExtended()) {
            warnings.add("OTM chase risk");
        }
        if (intel.getFreshness() != null && !"FRESH".equals(intel.getFreshness().getFreshness())) {
            warnings.add("Late entry");
        }
        if ("CHOPPY".equals(intel.getRegimeImpact())) {
            warnings.add("Spread too wide risk in chop");
        }
        if (rr != null && "POOR".equals(rr.getQuality())) {
            warnings.add("Poor RR for options");
        }
        if ("AVOID".equals(quality.getGrade()) || "C".equals(quality.getGrade())) {
            warnings.add("Theta risk elevated");
        }
        if (noEdge != null && noEdge.isNoEdge()) {
            warnings.add("No edge — skip options");
        }
        return warnings.stream().distinct().toList();
    }

    private String computeAlertPriority(SymbolIntelligenceDto intel, RiskRewardDto rr,
                                        TradeQualityDto quality, NoEdgeDto noEdge) {
        if (noEdge != null && noEdge.isNoEdge()) return "LOW";
        if (intel.getExtended() != null && intel.getExtended().isExtended()) return "LOW";
        if (intel.getFreshness() != null && intel.getFreshness().isStaleForOptions()) return "LOW";

        int score = 0;
        if (intel.getFreshness() != null && "FRESH".equals(intel.getFreshness().getFreshness())) score += 3;
        if (rr != null && "STRONG".equals(rr.getQuality())) score += 3;
        if (intel.getMtf() != null && intel.getMtf().getAlignmentScore() >= 70) score += 2;
        if ("A+".equals(quality.getGrade()) || "A".equals(quality.getGrade())) score += 2;
        if (intel.isRegimeAligned()) score += 1;

        if (score >= 6) return "HIGH";
        if (score >= 3) return "MEDIUM";
        return "LOW";
    }
}
