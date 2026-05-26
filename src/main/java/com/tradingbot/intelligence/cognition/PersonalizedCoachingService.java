package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.BehaviorInsightDto;
import com.tradingbot.api.dto.TraderEdgeDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.PersonalizedCoachingDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PersonalizedCoachingService {

    public PersonalizedCoachingDto coach(TraderEdgeDto edge, List<BehaviorInsightDto> behavior) {
        List<String> insights = new ArrayList<>();

        if (edge != null && edge.getSampleSize() > 0) {
            if (CognitionUtil.hasItems(edge.getWorstSetupTypes())) {
                insights.add("Underperforming: " + edge.getWorstSetupTypes().get(0));
            }
            if (CognitionUtil.hasItems(edge.getBestRegimes())) {
                insights.add("Strongest in " + edge.getBestRegimes().get(0) + " regimes");
            }
            if (CognitionUtil.hasItems(edge.getBestTimeWindows())) {
                insights.add("You are strongest " + edge.getBestTimeWindows().get(0));
            }
            if (CognitionUtil.hasItems(edge.getBestEntryQuality())) {
                insights.add("Best entries: " + edge.getBestEntryQuality().get(0));
            }
            if (CognitionUtil.hasItems(edge.getBestSetupTypes())) {
                insights.add("Edge in " + edge.getBestSetupTypes().get(0));
            }
        }

        for (BehaviorInsightDto b : CognitionUtil.safe(behavior)) {
            if (b.getDetail() != null && !b.getDetail().isBlank()) {
                insights.add(b.getDetail());
            }
        }

        if (insights.isEmpty()) {
            insights.add("Log journal outcomes to unlock personalized coaching.");
        }

        String strongest = edge != null && CognitionUtil.hasItems(edge.getBestSetupTypes())
                ? edge.getBestSetupTypes().get(0) : null;
        String weakest = edge != null && CognitionUtil.hasItems(edge.getWorstSetupTypes())
                ? edge.getWorstSetupTypes().get(0) : null;

        return PersonalizedCoachingDto.builder()
                .insights(insights.stream().limit(5).toList())
                .strongestEdge(strongest)
                .weakestPattern(weakest)
                .build();
    }
}
