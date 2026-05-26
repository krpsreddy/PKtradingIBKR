package com.tradingbot.intelligence;

import com.tradingbot.api.dto.TraderEdgeDto;
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
public class TraderPerformanceAnalyticsService {

    private final SignalOutcomeRepository outcomeRepository;

    public TraderEdgeDto computeEdge(int lookbackDays) {
        LocalDate since = MarketTime.nowLocal().toLocalDate().minusDays(lookbackDays);
        List<SignalOutcome> outcomes = outcomeRepository.findSince(since);

        if (outcomes.isEmpty()) {
            return TraderEdgeDto.builder()
                    .lookbackDays(lookbackDays)
                    .sampleSize(0)
                    .summary("Not enough trade data yet — log outcomes via journal.")
                    .build();
        }

        Map<String, List<SignalOutcome>> bySetup = group(outcomes, SignalOutcome::getSetupType);
        Map<String, List<SignalOutcome>> byRegime = group(outcomes, SignalOutcome::getRegime);
        Map<String, List<SignalOutcome>> byTime = group(outcomes, SignalOutcome::getTimeOfDay);
        Map<String, List<SignalOutcome>> byQuality = group(outcomes, SignalOutcome::getEntryQuality);

        return TraderEdgeDto.builder()
                .lookbackDays(lookbackDays)
                .sampleSize(outcomes.size())
                .bestSetupTypes(topKeys(bySetup, true))
                .worstSetupTypes(topKeys(bySetup, false))
                .bestRegimes(topKeys(byRegime, true))
                .bestTimeWindows(topKeys(byTime, true))
                .bestEntryQuality(topKeys(byQuality, true))
                .overallWinRate(winRate(outcomes))
                .summary(buildSummary(outcomes))
                .build();
    }

    private Map<String, List<SignalOutcome>> group(List<SignalOutcome> list,
                                                   java.util.function.Function<SignalOutcome, String> fn) {
        return list.stream()
                .filter(o -> fn.apply(o) != null && !fn.apply(o).isBlank())
                .collect(Collectors.groupingBy(fn));
    }

    private List<String> topKeys(Map<String, List<SignalOutcome>> map, boolean best) {
        return map.entrySet().stream()
                .filter(e -> e.getValue().size() >= 2)
                .sorted((a, b) -> {
                    double ra = winRate(a.getValue());
                    double rb = winRate(b.getValue());
                    return best ? Double.compare(rb, ra) : Double.compare(ra, rb);
                })
                .limit(3)
                .map(e -> e.getKey() + " (" + Math.round(winRate(e.getValue()) * 100) + "%)")
                .toList();
    }

    private double winRate(List<SignalOutcome> list) {
        long wins = list.stream().filter(o -> "WIN".equals(o.getOutcome())).count();
        long decided = list.stream().filter(o -> "WIN".equals(o.getOutcome()) || "LOSS".equals(o.getOutcome())).count();
        return decided > 0 ? (double) wins / decided : 0;
    }

    private String buildSummary(List<SignalOutcome> outcomes) {
        double wr = winRate(outcomes);
        return "Win rate " + Math.round(wr * 100) + "% over " + outcomes.size() + " recorded outcomes.";
    }
}
