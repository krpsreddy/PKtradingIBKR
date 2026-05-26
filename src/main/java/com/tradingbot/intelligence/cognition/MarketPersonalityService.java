package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.MarketPersonalityDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MarketPersonalityService {

    public MarketPersonalityDto analyze(MarketTrendDto trend, MarketMemoryDto memory) {
        if (trend == null) {
            return MarketPersonalityDto.builder()
                    .personality("unknown")
                    .description("Market personality unavailable.")
                    .traits(List.of())
                    .build();
        }

        List<String> traits = new ArrayList<>();
        String personality;
        String description;

        if (memory != null && memory.getContinuationSuccessRate() != null
                && memory.getContinuationSuccessRate() >= 0.65) {
            personality = "strong continuation";
            description = "Pullback entries are being rewarded — trends persist after consolidation.";
            traits.add("Trend persistence");
            traits.add("VWAP holds");
        } else if (memory != null && memory.getOpenMomentumSuccessRate() != null
                && memory.getOpenMomentumSuccessRate() < 0.35) {
            personality = "weak follow-through";
            description = "Opening spikes fade — avoid chasing first moves without confirmation.";
            traits.add("Gap fade risk");
            traits.add("Low open follow-through");
        } else if (trend.isChoppy()) {
            personality = "mean-reversion heavy";
            description = "Price oscillates around VWAP — breakouts fail, reversals dominate.";
            traits.add("Choppy regime");
            traits.add("Fake breakout risk");
        } else if (memory != null && memory.getEmergingSetupCount() > 6) {
            personality = "fast rotations";
            description = "Leadership rotates quickly — avoid holding stale leaders.";
            traits.add("High rotation");
            traits.add("Sector dispersion");
        } else if (memory != null && memory.getOpenMomentumSuccessRate() != null
                && memory.getOpenMomentumSuccessRate() >= 0.6) {
            personality = "opening spike dominant";
            description = "First 45 minutes drive edge — early momentum entries outperform.";
            traits.add("Open-driven");
            traits.add("Gap follow-through");
        } else if (memory != null && !memory.getFailingSetups().isEmpty() && memory.getFailingSetups().size() >= 2) {
            personality = "fake breakout heavy";
            description = "Breakouts lack volume confirmation — wait for retest entries.";
            traits.add("False breaks");
            traits.add("Volume divergence");
        } else if (trend.getRegime() != null && trend.getRegime().contains("TRENDING")) {
            personality = "trend persistence";
            description = "Directional bias holds — trade with trend on pullbacks.";
            traits.add(trend.getRegime());
            traits.add("Aligned breadth");
        } else {
            personality = "mixed personality";
            description = "No dominant behavior — stay selective until a clear edge emerges.";
            traits.add("Mixed signals");
        }

        return MarketPersonalityDto.builder()
                .personality(personality)
                .description(description)
                .traits(traits)
                .build();
    }
}
