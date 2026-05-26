package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.SetupDnaDto;
import com.tradingbot.intelligence.historical.MovementIntelligenceService;
import com.tradingbot.intelligence.historical.SetupStatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SetupDnaService {

    private final SetupStatisticsService setupStatisticsService;
    private final MovementIntelligenceService movementIntelligenceService;

    public SetupDnaDto personality(String setupType, String symbol) {
        String setup = SetupStatisticsService.normalize(setupType);
        var stats = setupStatisticsService.statistics(setup);
        var movement = movementIntelligenceService.analyze(setup, symbol);

        List<String> traits = new ArrayList<>();
        String personality;
        String description;

        double winRate = stats.getWinRate();
        double persistence = movement.getMovePersistenceProbability();
        double extension = movement.getExtensionProbability();

        if (setup.contains("OPEN_MOM") || setup.contains("OPEN")) {
            if (extension > 0.5) {
                personality = "EXPLOSIVE CONTINUATION";
                description = "Fast initial move with extension potential";
                traits.add("High velocity");
                traits.add("Extension prone");
            } else {
                personality = "FAKEOUT PRONE";
                description = "Strong open that often fades without volume";
                traits.add("Early peak");
                traits.add("Volume dependent");
            }
        } else if (setup.contains("CONT")) {
            if (persistence > 0.6) {
                personality = "HIGH PERSISTENCE";
                description = "Grinds higher with reliable follow-through";
                traits.add("Slow grind");
                traits.add("Pullback tolerant");
            } else {
                personality = "WEAK PERSISTENCE";
                description = "Continuation often stalls mid-session";
                traits.add("Exhaustion heavy");
            }
        } else if (setup.contains("FAIL")) {
            personality = "REVERSAL PRONE";
            description = "Failed momentum tends to mean-revert sharply";
            traits.add("Reversal prone");
            traits.add("Time sensitive");
        } else if (setup.contains("VWAP")) {
            personality = "SLOW GRIND";
            description = "VWAP reclaim setups build edge gradually";
            traits.add("Volume confirmation needed");
            traits.add("Afternoon decay");
        } else if (winRate > 0.58) {
            personality = "SQUEEZE HEAVY";
            description = "Tight consolidation before directional move";
            traits.add("Compression");
            traits.add("Breakout dependent");
        } else {
            personality = "EXHAUSTION HEAVY";
            description = "Extended moves often fade before target";
            traits.add("Late entry risk");
        }

        return SetupDnaDto.builder()
                .personality(personality)
                .description(description)
                .traits(traits)
                .build();
    }
}
