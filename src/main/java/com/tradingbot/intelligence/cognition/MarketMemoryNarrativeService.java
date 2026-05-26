package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.MarketMemoryNarrativeDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class MarketMemoryNarrativeService {

    public MarketMemoryNarrativeDto narrate(MarketMemoryDto memory) {
        List<String> lines = new ArrayList<>();
        if (memory == null) {
            lines.add("Session memory building — outcomes will refine rankings.");
            return MarketMemoryNarrativeDto.builder().narratives(lines).build();
        }

        if (memory.getNarratives() != null && !memory.getNarratives().isEmpty()) {
            lines.addAll(memory.getNarratives());
        } else {
            appendLegacyNarratives(memory, lines);
        }

        if (lines.isEmpty()) {
            lines.add("Insufficient session data for memory narrative.");
        }

        return MarketMemoryNarrativeDto.builder().narratives(lines).build();
    }

    private void appendLegacyNarratives(MarketMemoryDto memory, List<String> lines) {
        if (memory.getContinuationSuccessRate() != null) {
            if (memory.getContinuationSuccessRate() >= 0.6) {
                lines.add("Continuation setups strengthened this session.");
            } else if (memory.getContinuationSuccessRate() < 0.4) {
                lines.add("Continuation setups weakened after mid-morning.");
            }
        }

        if (memory.getOpenMomentumSuccessRate() != null && memory.getOpenMomentumSuccessRate() < 0.4) {
            lines.add("Opening momentum failed frequently today.");
        } else if (memory.getOpenMomentumSuccessRate() != null && memory.getOpenMomentumSuccessRate() >= 0.6) {
            lines.add("Opening momentum delivered strong follow-through.");
        }

        if (memory.getStrongestSetups() != null && !memory.getStrongestSetups().isEmpty()) {
            lines.add(String.format(Locale.US, "%s outperforming this session.",
                    String.join(", ", memory.getStrongestSetups().stream().limit(2).toList())));
        }

        if (memory.getEmergingSetupCount() > 0) {
            lines.add(memory.getEmergingSetupCount() + " emerging setups on watch.");
        }
    }
}
