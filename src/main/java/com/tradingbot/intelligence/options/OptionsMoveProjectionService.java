package com.tradingbot.intelligence.options;

import com.tradingbot.intelligence.options.OptionsThetaRiskService.ThetaAssessment;
import org.springframework.stereotype.Service;

@Service
public class OptionsMoveProjectionService {

    public record PremiumProjection(String label, boolean favorable, int lowPct, int highPct) {}

    public PremiumProjection project(OptionsIntelContext ctx, ThetaAssessment theta, String ivProfile) {
        var em = ctx.getExpectedMove();
        double stockLow = em != null && em.getTypicalMoveLowPercent() != null ? em.getTypicalMoveLowPercent() : 0.8;
        double stockHigh = em != null && em.getTypicalMoveHighPercent() != null ? em.getTypicalMoveHighPercent() : 1.5;

        double premiumMult = switch (ctx.getRvol() >= 2.5 ? "FAST" : ctx.getRvol() >= 1.5 ? "MOD" : "SLOW") {
            case "FAST" -> 1.35;
            case "MOD" -> 1.15;
            default -> 0.85;
        };

        if ("CRUSH_RISK".equals(ivProfile)) premiumMult *= 0.6;
        else if ("EXPANDING".equals(ivProfile)) premiumMult *= 1.2;

        if ("HIGH".equals(theta.level()) || "EXTREME".equals(theta.level())) premiumMult *= 0.7;
        if ("CHASING".equals(ctx.getEntryQuality())) premiumMult *= 0.55;

        int low = (int) Math.round(stockLow * premiumMult * 10);
        int high = (int) Math.round(stockHigh * premiumMult * 12);
        low = Math.max(5, Math.min(low, 45));
        high = Math.max(low + 5, Math.min(high, 55));

        boolean favorable = premiumMult >= 1.0 && !"CRUSH_RISK".equals(ivProfile);
        String label = favorable
                ? String.format("+%d–%d%%", low, high)
                : String.format("-%d–%d%%", Math.min(low, 22), Math.min(high, 30));
        return new PremiumProjection(label, favorable, low, high);
    }
}
