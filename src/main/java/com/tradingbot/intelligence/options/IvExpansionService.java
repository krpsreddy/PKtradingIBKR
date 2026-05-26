package com.tradingbot.intelligence.options;

import org.springframework.stereotype.Service;

@Service
public class IvExpansionService {

    public record IvAssessment(String profile, String label) {}

    public IvAssessment assess(OptionsIntelContext ctx) {
        double cont = ctx.getDecay().getContinuationCurrent();
        boolean strongMom = ctx.getRvol() >= 2.0 && cont >= 55 && !ctx.isChoppy();
        boolean postSpike = ctx.isExtended() || ctx.getDecay().getExhaustionProbability() >= 0.35;
        boolean weak = ctx.isChoppy() || cont < 45;

        if (postSpike && ctx.isExtended()) {
            return new IvAssessment("CRUSH_RISK", "IV crush risk elevated");
        }
        if (strongMom && !ctx.isExtended()) {
            return new IvAssessment("EXPANDING", "IV expansion likely");
        }
        if (weak) {
            return new IvAssessment("STABLE", "IV stable — avoid premium chase");
        }
        return new IvAssessment("STABLE", "IV stable");
    }
}
