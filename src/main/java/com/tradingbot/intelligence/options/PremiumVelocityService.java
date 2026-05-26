package com.tradingbot.intelligence.options;

import org.springframework.stereotype.Service;

@Service
public class PremiumVelocityService {

    public String velocity(OptionsIntelContext ctx) {
        String setup = ctx.getSignalType() != null ? ctx.getSignalType() : "";
        if (setup.contains("OPEN") && ctx.getRvol() >= 2.5) return "FAST";
        if (setup.contains("CONT") && ctx.getRvol() >= 1.8) return "MODERATE";
        if (ctx.isChoppy()) return "SLOW";
        if (ctx.getRvol() >= 2.0) return "MODERATE";
        return "SLOW";
    }
}
