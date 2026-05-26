package com.tradingbot.intelligence.historical;

import com.tradingbot.api.dto.historical.HistoricalDtos.TimeOfDayIntelligenceDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.repository.SignalOutcomeRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TimeOfDayIntelligenceService {

    private final SignalOutcomeRepository outcomeRepository;
    private final TradingProperties tradingProperties;

    public TimeOfDayIntelligenceDto analyze() {
        LocalDate since = MarketTime.nowLocal().toLocalDate().minusDays(tradingProperties.getIntelligenceLookbackDays());
        List<Object[]> rows = outcomeRepository.aggregateBySetupTime(since);

        Map<String, int[]> windowCounts = new HashMap<>();
        Map<String, Double> setupWinRatesByWindow = new LinkedHashMap<>();

        for (Object[] row : rows) {
            String setup = (String) row[0];
            String window = row[1] != null ? (String) row[1] : "UNKNOWN";
            String outcome = (String) row[2];
            int cnt = ((Long) row[3]).intValue();
            String key = setup + "|" + window;
            int[] c = windowCounts.computeIfAbsent(key, k -> new int[2]);
            if ("WIN".equals(outcome)) c[0] += cnt;
            else if ("LOSS".equals(outcome)) c[1] += cnt;
        }

        windowCounts.forEach((key, c) -> {
            int total = c[0] + c[1];
            if (total >= 2) {
                setupWinRatesByWindow.put(key, Math.round((double) c[0] / total * 1000) / 1000.0);
            }
        });

        List<String> insights = new ArrayList<>();
        String bestOpen = bestSetupForWindow(windowCounts, "OPEN");
        String middayFail = worstSetupForWindow(windowCounts, "MIDDAY");
        String afternoon = bestSetupForWindow(windowCounts, "AFTERNOON");

        if (bestOpen != null) insights.add("Opening leader: " + bestOpen);
        if (middayFail != null) insights.add("Midday weakness: " + middayFail);
        if (afternoon != null) insights.add("Afternoon continuation: " + afternoon);

        return TimeOfDayIntelligenceDto.builder()
                .setupWinRatesByWindow(setupWinRatesByWindow)
                .bestOpeningSetup(bestOpen)
                .middayFailurePattern(middayFail)
                .afternoonContinuationSetup(afternoon)
                .insights(insights)
                .build();
    }

    private String bestSetupForWindow(Map<String, int[]> counts, String window) {
        return counts.entrySet().stream()
                .filter(e -> e.getKey().endsWith("|" + window))
                .filter(e -> e.getValue()[0] + e.getValue()[1] >= 2)
                .max(Comparator.comparingDouble(e -> rate(e.getValue())))
                .map(e -> e.getKey().split("\\|")[0])
                .orElse(null);
    }

    private String worstSetupForWindow(Map<String, int[]> counts, String window) {
        return counts.entrySet().stream()
                .filter(e -> e.getKey().endsWith("|" + window))
                .filter(e -> e.getValue()[0] + e.getValue()[1] >= 2)
                .min(Comparator.comparingDouble(e -> rate(e.getValue())))
                .map(e -> e.getKey().split("\\|")[0])
                .orElse(null);
    }

    private double rate(int[] c) {
        int t = c[0] + c[1];
        return t > 0 ? (double) c[0] / t : 0;
    }
}
