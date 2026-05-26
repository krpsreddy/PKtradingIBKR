package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.SetupHalfLifeDto;
import com.tradingbot.intelligence.historical.SetupStatisticsService;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class SetupHalfLifeService {

    public SetupHalfLifeDto halfLife(String setupType, int setupAgeMinutes) {
        String setup = SetupStatisticsService.normalize(setupType);
        int peak, halfLife;
        String summary, timing;

        if (setup.contains("OPEN_MOM") || setup.contains("OPEN")) {
            peak = 12;
            halfLife = 18;
            summary = "OPEN_MOM strongest: first 12 minutes";
            timing = setupAgeMinutes > peak ? "Edge decaying — past peak window" : "Within peak edge window";
        } else if (setup.contains("CONT")) {
            peak = 18;
            halfLife = 30;
            summary = "CONT setups decay after ~18 minutes without follow-through";
            timing = setupAgeMinutes > halfLife ? "Half-life exceeded — reduce size" : "Edge still viable";
        } else if (setup.contains("VWAP")) {
            peak = 45;
            halfLife = 90;
            summary = "VWAP reclaim quality drops sharply after 1PM";
            timing = setupAgeMinutes > 120 ? "Late-day reclaim — elevated decay" : "Reclaim window active";
        } else if (setup.contains("FAIL")) {
            peak = 15;
            halfLife = 25;
            summary = "Failed momentum edge peaks in first 15 minutes";
            timing = setupAgeMinutes > halfLife ? "Fail setup aging — watch for reversal" : "Active fail window";
        } else {
            peak = 20;
            halfLife = 35;
            summary = "Setup edge typically peaks within first 20 minutes";
            timing = "Monitor freshness decay";
        }

        return SetupHalfLifeDto.builder()
                .setupType(setup)
                .peakEdgeMinutes(peak)
                .halfLifeMinutes(halfLife)
                .summary(summary)
                .timingGuidance(timing)
                .build();
    }
}
