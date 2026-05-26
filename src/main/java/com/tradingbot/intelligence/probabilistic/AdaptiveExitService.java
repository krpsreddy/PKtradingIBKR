package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.AdaptiveExitDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.ProbabilityDecayDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.FailureSignatureDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdaptiveExitService {

    public AdaptiveExitDto guidance(ProbabilityDecayDto decay, FailureSignatureDto failure,
                                    int setupAgeMinutes, int halfLifeMinutes,
                                    String exhaustionRisk, double rvol) {
        List<String> triggers = new ArrayList<>();
        String state;
        String guidance;
        boolean optionsDecay = false;

        if (failure.getFailureProbability() >= 60 || decay.getFailureProbability() >= 45) {
            state = "EXIT_NOW";
            guidance = "Failure probability elevated — protect capital";
            triggers.add("Failure signature active");
        } else if ("HIGH".equals(exhaustionRisk) || decay.getExhaustionProbability() >= 55) {
            state = "EXIT_SOON";
            guidance = "Exhaustion risk rising — consider scaling out";
            triggers.add("Exhaustion probability high");
            optionsDecay = setupAgeMinutes > halfLifeMinutes;
        } else if (decay.getContinuationProbability() < decay.getContinuationStart() - 15) {
            state = "SCALE_PARTIAL";
            guidance = "Continuation weakening — take partial profits";
            triggers.add("Probability decay detected");
        } else if (decay.getContinuationProbability() >= 65 && failure.getFailureProbability() < 25) {
            state = "HOLD";
            guidance = "Edge intact — hold with trailing stop";
        } else if (rvol > 0 && rvol < 1.1) {
            state = "TAKE_PROFIT";
            guidance = "RVOL collapse — momentum fading";
            triggers.add("RVOL deterioration");
            optionsDecay = true;
        } else {
            state = "HOLD";
            guidance = "Monitor probability evolution";
        }

        if (setupAgeMinutes > halfLifeMinutes * 1.5) {
            optionsDecay = true;
            if (!triggers.contains("Past half-life")) triggers.add("Past half-life");
        }

        return AdaptiveExitDto.builder()
                .state(state)
                .guidance(guidance)
                .triggers(triggers)
                .optionsEdgeDeteriorating(optionsDecay)
                .build();
    }
}
