package com.tradingbot.intelligence.options;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class CapitalPreservationService {

    public record PreservationState(String mode, String message, List<String> reasons) {}

    public PreservationState assess(OptionsIntelContext ctx, MarketTrendDto trend, MarketMemoryDto memory,
                                    int optionConfidence) {
        List<String> reasons = new ArrayList<>();
        int riskScore = 0;

        if (ctx.isChoppy()) {
            riskScore += 2;
            reasons.add("Choppy regime");
        }
        if (!ctx.isRegimeAligned()) {
            riskScore += 2;
            reasons.add("Weak regime alignment");
        }
        if (ctx.getFailure().getFailureProbability() >= 40) {
            riskScore += 2;
            reasons.add("Elevated failure probability");
        }
        if ("CHASING".equals(ctx.getEntryQuality()) || "LATE".equals(ctx.getEntryQuality())) {
            riskScore += 2;
            reasons.add("Late entry");
        }
        if (memory != null && memory.getFakeBreakoutFrequency() != null && memory.getFakeBreakoutFrequency() > 0.5) {
            riskScore += 2;
            reasons.add("Failed breakouts elevated");
        }
        if (trend != null && trend.getSpyPersistence() != null && trend.getSpyPersistence() < 0.35) {
            riskScore += 1;
            reasons.add("Weak breadth");
        }
        if (optionConfidence < 40) {
            riskScore += 2;
            reasons.add("Low options edge");
        }
        if (ctx.getExit() != null && "EXIT_NOW".equals(ctx.getExit().getState())) {
            riskScore += 3;
            reasons.add("Exit urgency");
        }

        String mode;
        String message;
        if (riskScore >= 7) {
            mode = "PRESERVE_CAPITAL";
            message = "Preserve capital — no edge";
        } else if (riskScore >= 5) {
            mode = "NO_EDGE";
            message = "No edge — stand down";
        } else if (riskScore >= 3) {
            mode = "WAIT";
            message = "Wait — conditions not ideal";
        } else if (riskScore >= 1) {
            mode = "DO_NOTHING";
            message = "Do nothing unless trigger confirms";
        } else {
            mode = "CLEAR";
            message = null;
        }

        return new PreservationState(mode, message, reasons.stream().distinct().limit(4).toList());
    }
}
