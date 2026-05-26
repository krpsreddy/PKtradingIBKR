package com.tradingbot.intelligence.options;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.OptionsExecutionSnapshotDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OptionsExecutionService {

    private final StrikeSelectionService strikeSelectionService;
    private final OptionsThetaRiskService thetaRiskService;
    private final IvExpansionService ivExpansionService;
    private final PremiumVelocityService premiumVelocityService;
    private final OptionsMoveProjectionService moveProjectionService;

    public OptionsExecutionSnapshotDto analyze(OptionsIntelContext ctx) {
        int conviction = computeConviction(ctx);
        var strike = strikeSelectionService.select(ctx, conviction);
        var theta = thetaRiskService.assess(ctx);
        var iv = ivExpansionService.assess(ctx);
        var premium = moveProjectionService.project(ctx, theta, iv.profile());
        String velocity = premiumVelocityService.velocity(ctx);

        String direction = idealDirection(ctx.getSignalType());
        int quality = computeQuality(ctx, conviction, theta.level(), iv.profile());
        int confidence = Math.max(0, Math.min(100, quality - penalty(ctx)));

        String holdWindow = formatHoldWindow(ctx);
        String avoidReason = buildAvoidReason(ctx, theta, iv, confidence);

        List<String> thetaWarnings = new ArrayList<>(theta.warnings());
        if ("CRUSH_RISK".equals(iv.profile())) {
            thetaWarnings.add("IV crush risk elevated");
        }

        return OptionsExecutionSnapshotDto.builder()
                .idealDirection(direction)
                .recommendedStrikeType(strike.strikeType())
                .recommendedExpiry(strike.expiry())
                .strikeGuidance(strike.guidance())
                .expectedPremiumExpansion(premium.favorable() ? premium.label() : null)
                .expectedPremiumDeterioration(premium.favorable() ? null : premium.label())
                .thetaRisk(theta.level())
                .thetaWarnings(thetaWarnings)
                .ivRisk(iv.profile())
                .ivLabel(iv.label())
                .holdWindow(holdWindow)
                .expectedMoveVelocity(velocity)
                .optionExecutionQuality(quality)
                .optionConfidence(confidence)
                .avoidReason(avoidReason)
                .build();
    }

    private int computeConviction(OptionsIntelContext ctx) {
        int score = (int) ctx.getDecay().getContinuationCurrent();
        if ("EARLY".equals(ctx.getEntryQuality()) || "GOOD".equals(ctx.getEntryQuality())) score += 10;
        if (ctx.isRegimeAligned()) score += 8;
        if (ctx.getRvol() >= 2) score += 5;
        if (ctx.isExtended() || ctx.isDeteriorating()) score -= 15;
        if (ctx.getFailure().getFailureProbability() >= 40) score -= 12;
        return Math.max(0, Math.min(100, score));
    }

    private int computeQuality(OptionsIntelContext ctx, int conviction, String theta, String iv) {
        int q = conviction;
        if ("LOW".equals(theta)) q += 5;
        if ("EXTREME".equals(theta) || "HIGH".equals(theta)) q -= 15;
        if ("EXPANDING".equals(iv)) q += 8;
        if ("CRUSH_RISK".equals(iv)) q -= 18;
        if ("CHASING".equals(ctx.getEntryQuality())) q -= 20;
        return Math.max(0, Math.min(100, q));
    }

    private int penalty(OptionsIntelContext ctx) {
        int p = 0;
        if (ctx.isChoppy()) p += 10;
        if (!ctx.isRegimeAligned()) p += 8;
        return p;
    }

    private String formatHoldWindow(OptionsIntelContext ctx) {
        int peak = ctx.getHalfLife().getPeakEdgeMinutes();
        int half = ctx.getHalfLife().getHalfLifeMinutes();
        int low = Math.max(10, (int) (peak * 0.8));
        int high = Math.max(low + 10, half);
        return low + "–" + high + "m optimal";
    }

    private String buildAvoidReason(OptionsIntelContext ctx, OptionsThetaRiskService.ThetaAssessment theta,
                                    IvExpansionService.IvAssessment iv, int confidence) {
        if (confidence >= 50 && !"EXTREME".equals(theta.level())) return null;
        List<String> parts = new ArrayList<>();
        if ("EXTREME".equals(theta.level()) || "HIGH".equals(theta.level())) parts.add("Theta too dangerous");
        if ("CRUSH_RISK".equals(iv.profile())) parts.add("IV crush risk");
        if ("CHASING".equals(ctx.getEntryQuality())) parts.add("Late entry");
        if (ctx.isChoppy()) parts.add("Choppy regime");
        if (confidence < 35) parts.add("Low option edge");
        return parts.isEmpty() ? null : String.join(" · ", parts);
    }

    private String idealDirection(String signalType) {
        if (signalType == null) return "NONE";
        if (signalType.contains("FAIL") || signalType.contains("IMBALANCE_DOWN")) return "PUTS";
        if (signalType.contains("BUY") || signalType.contains("MOM") || signalType.contains("CONT")
                || signalType.contains("SCOUT") || signalType.contains("PULL")) return "CALLS";
        return "NONE";
    }
}
