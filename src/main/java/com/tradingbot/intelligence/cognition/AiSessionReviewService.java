package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.BehaviorInsightDto;
import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.TraderEdgeDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.AiSessionReviewDto;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AiSessionReviewService {

    public AiSessionReviewDto review(MarketMemoryDto memory,
                                     TraderEdgeDto edge,
                                     List<BehaviorInsightDto> behavior) {
        List<String> bestOpps = memory != null ? memory.getStrongestSetups() : List.of();
        List<String> failed = memory != null ? memory.getFailingSetups() : List.of();
        List<String> strengths = new ArrayList<>();
        List<String> mistakes = new ArrayList<>();
        List<String> coaching = new ArrayList<>();

        for (BehaviorInsightDto b : behavior) {
            if ("POSITIVE".equals(b.getType())) strengths.add(b.getTitle());
            else mistakes.add(b.getTitle());
            if (b.getDetail() != null) coaching.add(b.getDetail());
        }

        if (edge != null && CognitionUtil.hasItems(edge.getBestSetupTypes())) {
            strengths.add("Historical edge: " + edge.getBestSetupTypes().get(0));
        }
        if (edge != null && CognitionUtil.hasItems(edge.getWorstSetupTypes())) {
            mistakes.add("Weak pattern: " + edge.getWorstSetupTypes().get(0));
        }

        String bestPlaybook = CognitionUtil.hasItems(bestOpps) ? bestOpps.get(0) : "CONT";
        String narrative = buildNarrative(memory, edge, behavior, bestPlaybook);

        List<String> sectors = new ArrayList<>();
        if (memory != null && memory.getContinuationSuccessRate() != null
                && memory.getContinuationSuccessRate() >= 0.6) {
            sectors.add("Semiconductors / trend leaders");
        }

        return AiSessionReviewDto.builder()
                .narrative(narrative)
                .bestOpportunities(bestOpps)
                .strongestSectors(sectors)
                .failedPatterns(failed)
                .traderStrengths(strengths.stream().limit(4).toList())
                .traderMistakes(mistakes.stream().limit(4).toList())
                .regimeTransitions(List.of())
                .behaviorCoaching(coaching.stream().limit(4).toList())
                .bestPlaybook(bestPlaybook)
                .build();
    }

    private String buildNarrative(MarketMemoryDto memory, TraderEdgeDto edge,
                                  List<BehaviorInsightDto> behavior, String bestPlaybook) {
        StringBuilder sb = new StringBuilder();
        sb.append("Session review for ").append(MarketTime.nowLocal().toLocalDate()).append(". ");

        if (memory != null && CognitionUtil.hasItems(memory.getStrongestSetups())) {
            sb.append("Best opportunities came from ").append(String.join(", ", memory.getStrongestSetups().stream().limit(2).toList())).append(". ");
        }
        if (memory != null && CognitionUtil.hasItems(memory.getFailingSetups())) {
            sb.append("Failed patterns: ").append(String.join(", ", memory.getFailingSetups().stream().limit(2).toList())).append(". ");
        }
        if (edge != null && edge.getSampleSize() > 0) {
            sb.append(String.format("Overall win rate %.0f%% over %d outcomes. ", edge.getOverallWinRate() * 100, edge.getSampleSize()));
        }
        if (!behavior.isEmpty()) {
            sb.append("Key behavior note: ").append(behavior.get(0).getTitle()).append(". ");
        }
        sb.append("Best playbook today: ").append(bestPlaybook).append(".");
        return sb.toString();
    }
}
