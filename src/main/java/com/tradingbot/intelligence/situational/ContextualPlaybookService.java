package com.tradingbot.intelligence.situational;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.MarketPersonalityDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.ContextualPlaybookHintDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ContextualPlaybookService {

    public List<ContextualPlaybookHintDto> hints(MarketTrendDto trend, MarketMemoryDto memory,
                                                 MarketPersonalityDto personality) {
        List<ContextualPlaybookHintDto> hints = new ArrayList<>();
        String regime = trend != null ? trend.getRegime() : "TRENDING_BULL";

        if ("TRENDING_BULL".equals(regime)) {
            hints.add(hint("CONT", "FAVORING", "Continuation excellent in trending bull"));
            hints.add(hint("OPEN_MOM", "NEUTRAL", "Open momentum viable with volume"));
        } else if ("CHOPPY".equals(regime)) {
            hints.add(hint("CONT", "WEAK", "Continuation underperforms in chop"));
            hints.add(hint("OPEN_FAIL", "FAVORING", "Failed momentum favored in choppy tape"));
            hints.add(hint("OPEN_MOM", "WEAK", "Open momentum unreliable in chop"));
        } else if ("TRENDING_BEAR".equals(regime)) {
            hints.add(hint("OPEN_FAIL", "FAVORING", "Failed momentum aligned with bear regime"));
            hints.add(hint("OPEN_MOM", "WEAK", "Long momentum weak in bear trend"));
        }

        if (memory != null && memory.getContinuationSuccessRate() != null
                && memory.getContinuationSuccessRate() >= 0.6) {
            hints.add(hint("CONT", "FAVORING", "Session history favors continuation"));
        }
        if (memory != null && memory.getOpenMomentumSuccessRate() != null
                && memory.getOpenMomentumSuccessRate() < 0.4) {
            hints.add(hint("OPEN_MOM", "WEAK", "Opening momentum failing recently"));
        }

        if (personality != null && personality.getPersonality() != null) {
            if (personality.getPersonality().contains("MOMENTUM")) {
                hints.add(hint("CONT", "FAVORING", "Market personality: momentum day"));
            }
            if (personality.getPersonality().contains("REVERSAL")) {
                hints.add(hint("OPEN_FAIL", "FAVORING", "Reversal-heavy personality"));
            }
        }

        return hints.stream()
                .collect(java.util.stream.Collectors.toMap(
                        ContextualPlaybookHintDto::getPlaybookId,
                        h -> h,
                        (a, b) -> "FAVORING".equals(a.getStatus()) ? a : b,
                        java.util.LinkedHashMap::new))
                .values().stream().limit(6).toList();
    }

    private ContextualPlaybookHintDto hint(String playbookId, String status, String reason) {
        return ContextualPlaybookHintDto.builder()
                .playbookId(playbookId)
                .status(status)
                .reason(reason)
                .build();
    }
}
