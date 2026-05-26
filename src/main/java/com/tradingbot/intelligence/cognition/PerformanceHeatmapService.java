package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.cognition.CognitionPartDtos.PerformanceHeatmapDto;
import com.tradingbot.models.SignalOutcome;
import com.tradingbot.repository.SignalOutcomeRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PerformanceHeatmapService {

    private final SignalOutcomeRepository outcomeRepository;

    public PerformanceHeatmapDto heatmap(int lookbackDays) {
        LocalDate since = MarketTime.nowLocal().toLocalDate().minusDays(lookbackDays);
        List<SignalOutcome> outcomes = outcomeRepository.findSince(since);

        if (outcomes.isEmpty()) {
            return PerformanceHeatmapDto.builder()
                    .setupWinRates(Map.of())
                    .timeWindowWinRates(Map.of())
                    .regimeWinRates(Map.of())
                    .worstBehaviors(List.of("Log journal outcomes to populate heatmap"))
                    .executionQualityDistribution(Map.of())
                    .rrDistribution(Map.of())
                    .build();
        }

        return PerformanceHeatmapDto.builder()
                .setupWinRates(winRates(outcomes, SignalOutcome::getSetupType))
                .timeWindowWinRates(winRates(outcomes, SignalOutcome::getTimeOfDay))
                .regimeWinRates(winRates(outcomes, SignalOutcome::getRegime))
                .worstBehaviors(worstBehaviors(outcomes))
                .executionQualityDistribution(distribution(outcomes, SignalOutcome::getEntryQuality))
                .rrDistribution(rrDistribution(outcomes))
                .build();
    }

    private Map<String, Double> winRates(List<SignalOutcome> outcomes,
                                         java.util.function.Function<SignalOutcome, String> fn) {
        return outcomes.stream()
                .filter(o -> fn.apply(o) != null && !fn.apply(o).isBlank())
                .collect(Collectors.groupingBy(fn))
                .entrySet().stream()
                .filter(e -> e.getValue().size() >= 2)
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> winRate(e.getValue()),
                        (a, b) -> a,
                        LinkedHashMap::new
                ));
    }

    private double winRate(List<SignalOutcome> list) {
        long wins = list.stream().filter(o -> "WIN".equals(o.getOutcome())).count();
        long total = list.stream().filter(o -> "WIN".equals(o.getOutcome()) || "LOSS".equals(o.getOutcome())).count();
        return total > 0 ? Math.round((double) wins / total * 100) / 100.0 : 0;
    }

    private List<String> worstBehaviors(List<SignalOutcome> outcomes) {
        List<String> bad = new ArrayList<>();
        long late = outcomes.stream().filter(o -> "LATE".equals(o.getEntryQuality()) || "CHASING".equals(o.getEntryQuality())).count();
        if (late >= 2) bad.add("Late entries (" + late + ")");
        long poorGrade = outcomes.stream().filter(o -> "D".equals(o.getTradeQualityGrade()) || "F".equals(o.getTradeQualityGrade())).count();
        if (poorGrade >= 1) bad.add("Poor trade quality grades");
        if (bad.isEmpty()) bad.add("No major behavior flags");
        return bad;
    }

    private Map<String, Integer> distribution(List<SignalOutcome> outcomes,
                                              java.util.function.Function<SignalOutcome, String> fn) {
        return outcomes.stream()
                .filter(o -> fn.apply(o) != null)
                .collect(Collectors.groupingBy(fn, Collectors.summingInt(o -> 1)));
    }

    private Map<String, Integer> rrDistribution(List<SignalOutcome> outcomes) {
        Map<String, Integer> map = new LinkedHashMap<>();
        map.put("<1R", 0);
        map.put("1-2R", 0);
        map.put("2R+", 0);
        for (SignalOutcome o : outcomes) {
            if (o.getRrAchieved() == null) continue;
            double rr = o.getRrAchieved();
            if (rr < 1) map.merge("<1R", 1, Integer::sum);
            else if (rr < 2) map.merge("1-2R", 1, Integer::sum);
            else map.merge("2R+", 1, Integer::sum);
        }
        return map;
    }
}
