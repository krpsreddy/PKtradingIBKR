package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.OptionsExpectancyDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.SetupHalfLifeDto;
import org.springframework.stereotype.Service;

@Service
public class OptionsExpectancyService {

    public OptionsExpectancyDto analyze(String setupType, int setupAgeMinutes, SetupHalfLifeDto halfLife,
                                        double movePersistence, String entryQuality) {
        double idealHold = halfLife.getPeakEdgeMinutes() * 1.5;
        String speed = setupType != null && setupType.contains("OPEN") ? "FAST"
                : setupType != null && setupType.contains("CONT") ? "MODERATE" : "SLOW";

        double lateDecay = 0.1;
        if ("LATE".equals(entryQuality) || "CHASING".equals(entryQuality)) lateDecay = 0.45;
        else if (setupAgeMinutes > halfLife.getHalfLifeMinutes()) lateDecay = 0.35;
        else if (setupAgeMinutes > halfLife.getPeakEdgeMinutes()) lateDecay = 0.2;

        double extension = Math.min(0.8, 1.0 - movePersistence + (setupAgeMinutes > 30 ? 0.15 : 0));

        String warning = null;
        if (lateDecay >= 0.35 || setupAgeMinutes > halfLife.getHalfLifeMinutes()) {
            warning = "Options Edge Deteriorating";
        }

        return OptionsExpectancyDto.builder()
                .idealHoldMinutes(idealHold)
                .moveSpeed(speed)
                .lateEntryDecayRisk(Math.round(lateDecay * 100) / 100.0)
                .extensionRisk(Math.round(extension * 100) / 100.0)
                .warning(warning)
                .build();
    }
}
