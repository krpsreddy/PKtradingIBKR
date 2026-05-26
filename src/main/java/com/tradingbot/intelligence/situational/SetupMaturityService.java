package com.tradingbot.intelligence.situational;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.SetupMaturityDto;
import com.tradingbot.intelligence.dto.SetupDeteriorationDto;
import com.tradingbot.intelligence.dto.SignalFreshnessDto;
import com.tradingbot.intelligence.dto.SymbolIntelligenceDto;
import com.tradingbot.models.TradingSignal;
import org.springframework.stereotype.Service;

@Service
public class SetupMaturityService {

    public SetupMaturityDto maturity(String signalType, TradingSignal signal,
                                     SymbolIntelligenceDto intel, SetupDeteriorationDto deterioration) {
        String type = signalType != null ? signalType.toUpperCase() : "WATCH";
        String stage;
        String label;
        int score;

        if (deterioration != null && "FAILING".equals(deterioration.getState())) {
            stage = "FAILING";
            label = "Setup failing";
            score = 15;
        } else if (deterioration != null && "WEAKENING".equals(deterioration.getState())) {
            stage = "WEAKENING";
            label = "Edge decaying";
            score = 35;
        } else if (intel != null && intel.getExtended() != null && intel.getExtended().isExtended()) {
            stage = "EXTENDED";
            label = "Extended from value";
            score = 40;
        } else if (type.contains("_BUY") || type.contains("OPEN_MOM") || type.contains("CONT_BUY")) {
            String fresh = intel != null && intel.getFreshness() != null
                    ? intel.getFreshness().getFreshness() : null;
            String life = signal != null ? signal.getLifecycleState() : null;
            if ("NEW".equals(life) || "FRESH".equals(fresh)) {
                stage = "CONFIRMED";
                label = "Triggered & confirmed";
                score = 85;
            } else {
                stage = "TRIGGERED";
                label = "Entry triggered";
                score = 72;
            }
        } else if (type.contains("READY") || type.contains("SCOUT")) {
            stage = "BUILDING";
            label = "Near trigger";
            score = 58;
        } else if (type.contains("WATCH") || type.equals("NONE")) {
            stage = "FORMING";
            label = "Forming";
            score = 30;
        } else {
            stage = "BUILDING";
            label = "Building";
            score = 50;
        }

        SignalFreshnessDto fresh = intel != null ? intel.getFreshness() : null;
        if (fresh != null && "STALE".equals(fresh.getFreshness()) && !"FAILING".equals(stage)) {
            stage = "WEAKENING";
            score = Math.min(score, 38);
        }

        return SetupMaturityDto.builder()
                .stage(stage)
                .label(label)
                .score(score)
                .build();
    }
}
