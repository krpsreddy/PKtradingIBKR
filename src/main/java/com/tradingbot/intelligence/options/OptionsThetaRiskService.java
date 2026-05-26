package com.tradingbot.intelligence.options;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class OptionsThetaRiskService {

    public record ThetaAssessment(String level, List<String> warnings) {}

    public ThetaAssessment assess(OptionsIntelContext ctx) {
        int mins = ctx.getEtHour() * 60 + ctx.getEtMinute();
        List<String> warnings = new ArrayList<>();
        int score = 0;

        if (mins >= 810) { // 1:30 PM ET
            score += 2;
            warnings.add("Theta decay accelerating");
        }
        if (mins >= 900) { // 3:00 PM ET
            score += 2;
            warnings.add("Late-day premium decay elevated");
        }
        if (mins >= 930) { // 3:30 PM ET
            score += 2;
            warnings.add("Same-day contracts risky");
        }

        if (ctx.isChoppy()) {
            score += 2;
            warnings.add("Choppy regime — short-dated theta penalty");
        }
        if ("LATE".equals(ctx.getEntryQuality()) || "CHASING".equals(ctx.getEntryQuality())) {
            score += 2;
        }
        if (ctx.getSetupAgeMinutes() > ctx.getHalfLife().getHalfLifeMinutes()) {
            score += 1;
        }

        String level = score >= 6 ? "EXTREME" : score >= 4 ? "HIGH" : score >= 2 ? "MODERATE" : "LOW";
        return new ThetaAssessment(level, warnings.stream().distinct().limit(3).toList());
    }
}
