package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.IntelligenceSummaryDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.MarketPersonalityDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.PersonalizedCoachingDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.SessionPriorityDto;
import org.springframework.stereotype.Service;

@Service
public class IntelligenceSummarizationService {

    public IntelligenceSummaryDto summarize(SessionPriorityDto priority,
                                            MarketTrendDto trend,
                                            MarketMemoryDto memory,
                                            PersonalizedCoachingDto personalized,
                                            MarketPersonalityDto personality) {
        String strongest = memory != null && CognitionUtil.hasItems(memory.getStrongestSetups())
                ? String.join(", ", memory.getStrongestSetups().stream().limit(3).toList())
                : "Awaiting session data";

        String avoid = memory != null && CognitionUtil.hasItems(memory.getFailingSetups())
                ? String.join(", ", memory.getFailingSetups().stream().limit(2).toList())
                : (trend != null && trend.isChoppy() ? "Extended breakouts in CHOPPY regime" : "Low RVOL breakouts");

        String behavior = personalized != null && personalized.getWeakestPattern() != null
                ? personalized.getWeakestPattern()
                : "No behavior data yet";

        String playbook = memory != null && CognitionUtil.hasItems(memory.getStrongestSetups())
                ? memory.getStrongestSetups().get(0)
                : "CONT";

        return IntelligenceSummaryDto.builder()
                .whatMattersMost(priority != null ? priority.getInsight() : "Maintain selectivity")
                .whatToAvoid(avoid)
                .strongestSetupsToday(strongest)
                .behaviorHurtingPerformance(behavior)
                .activeRegime(trend != null ? trend.getRegime() : "—")
                .bestPlaybookToday(playbook)
                .build();
    }
}
