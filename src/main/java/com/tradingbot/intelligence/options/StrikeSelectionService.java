package com.tradingbot.intelligence.options;

import org.springframework.stereotype.Service;

@Service
public class StrikeSelectionService {

    public record StrikeGuidance(String strikeType, String expiry, String guidance) {}

    public StrikeGuidance select(OptionsIntelContext ctx, int convictionScore) {
        int mins = ctx.getEtHour() * 60 + ctx.getEtMinute();
        boolean lateDay = mins >= 810;
        boolean highConviction = convictionScore >= 65 && !ctx.isDeteriorating();
        boolean lowConviction = convictionScore < 45 || ctx.isDeteriorating();

        String strikeType;
        String guidance;

        if (ctx.isChoppy()) {
            strikeType = "SLIGHT_ITM";
            guidance = "Slightly ITM safer in chop";
        } else if (highConviction) {
            strikeType = "ATM";
            guidance = "ATM Calls Preferred";
            if (isBearish(ctx.getSignalType())) {
                guidance = "ATM Puts Preferred";
            }
        } else if (lowConviction) {
            strikeType = "AVOID_OTM";
            guidance = "Avoid far OTM contracts";
        } else {
            strikeType = "ATM";
            guidance = "ATM preferred — size down";
        }

        String expiry;
        if (lateDay) {
            expiry = "NEXT_WEEK";
            guidance = guidance + " · Use next-week expiry";
        } else if (mins >= 930) {
            expiry = "AVOID_0DTE";
            guidance = "Same-day expiry too risky";
        } else {
            expiry = "THIS_WEEK";
        }

        return new StrikeGuidance(strikeType, expiry, guidance);
    }

    private boolean isBearish(String signalType) {
        if (signalType == null) return false;
        return signalType.contains("FAIL") || signalType.contains("IMBALANCE_DOWN");
    }
}
