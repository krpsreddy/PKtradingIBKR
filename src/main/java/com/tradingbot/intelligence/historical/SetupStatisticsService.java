package com.tradingbot.intelligence.historical;

import com.tradingbot.api.dto.historical.HistoricalDtos.SetupStatisticsDto;
import com.tradingbot.config.TradingProperties;
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
public class SetupStatisticsService {

    private final SignalOutcomeRepository outcomeRepository;
    private final TradingProperties tradingProperties;
    private volatile Map<String, SetupStatisticsDto> cache = Map.of();
    private volatile long cacheTs;

    public SetupStatisticsDto statistics(String setupType) {
        return statistics(setupType, tradingProperties.getIntelligenceLookbackDays());
    }

    public SetupStatisticsDto statistics(String setupType, int lookbackDays) {
        refreshCacheIfNeeded(lookbackDays);
        return cache.getOrDefault(normalize(setupType), emptyStats(setupType, lookbackDays));
    }

    public List<SetupStatisticsDto> allSetupStatistics(int lookbackDays) {
        refreshCacheIfNeeded(lookbackDays);
        return cache.values().stream()
                .sorted(Comparator.comparingDouble(SetupStatisticsDto::getWinRate).reversed())
                .toList();
    }

    private void refreshCacheIfNeeded(int lookbackDays) {
        if (System.currentTimeMillis() - cacheTs < 120_000 && !cache.isEmpty()) return;
        LocalDate since = MarketTime.nowLocal().toLocalDate().minusDays(lookbackDays);
        List<SignalOutcome> outcomes = outcomeRepository.findSince(since);
        Map<String, List<SignalOutcome>> bySetup = outcomes.stream()
                .filter(o -> o.getSetupType() != null)
                .collect(Collectors.groupingBy(o -> normalize(o.getSetupType())));

        Map<String, SetupStatisticsDto> built = new LinkedHashMap<>();
        for (Map.Entry<String, List<SignalOutcome>> e : bySetup.entrySet()) {
            built.put(e.getKey(), build(e.getKey(), e.getValue(), lookbackDays));
        }
        cache = built;
        cacheTs = System.currentTimeMillis();
    }

    private SetupStatisticsDto build(String setup, List<SignalOutcome> list, int lookbackDays) {
        long wins = list.stream().filter(o -> "WIN".equals(o.getOutcome())).count();
        long losses = list.stream().filter(o -> "LOSS".equals(o.getOutcome())).count();
        long decided = wins + losses;
        double wr = decided > 0 ? (double) wins / decided : 0;

        Double avgRr = avg(list.stream().map(SignalOutcome::getRrAchieved).filter(Objects::nonNull).toList());
        Double avgCont = avg(list.stream().map(SignalOutcome::getContinuationDistance).filter(Objects::nonNull).toList());
        Double avgFail = avg(list.stream().map(SignalOutcome::getFailureDistance).filter(Objects::nonNull).toList());
        Double avgDur = avg(list.stream().map(o -> o.getDurationMinutes() != null ? o.getDurationMinutes().doubleValue() : null)
                .filter(Objects::nonNull).toList());
        Double avgMfe = avg(list.stream().map(SignalOutcome::getMaxFavorableExcursion).filter(Objects::nonNull).toList());

        long followThrough = list.stream().filter(o -> Boolean.TRUE.equals(o.getFollowThrough())).count();
        double ftp = decided > 0 ? (double) followThrough / decided : 0;

        List<String> insights = new ArrayList<>();
        insights.add(String.format(Locale.US, "%.0f%% win rate over %d sessions", wr * 100, lookbackDays));
        if (avgCont != null) insights.add(String.format(Locale.US, "Avg continuation: %.1f%%", avgCont * 100));
        if (avgRr != null) insights.add(String.format(Locale.US, "Avg RR: %.1f", avgRr));

        return SetupStatisticsDto.builder()
                .setupType(setup)
                .lookbackDays(lookbackDays)
                .sampleSize(list.size())
                .winRate(Math.round(wr * 1000) / 1000.0)
                .avgRr(avgRr)
                .avgContinuation(avgCont)
                .avgFailure(avgFail)
                .avgDurationMinutes(avgDur)
                .avgMfe(avgMfe)
                .bestRegime(bestKey(list, SignalOutcome::getRegime, true))
                .worstRegime(bestKey(list, SignalOutcome::getRegime, false))
                .bestTimeWindow(bestKey(list, SignalOutcome::getTimeOfDay, true))
                .bestSector(bestKey(list, SignalOutcome::getSector, true))
                .followThroughProbability(Math.round(ftp * 1000) / 1000.0)
                .insights(insights)
                .build();
    }

    private String bestKey(List<SignalOutcome> list,
                           java.util.function.Function<SignalOutcome, String> fn, boolean best) {
        Map<String, int[]> counts = new HashMap<>();
        for (SignalOutcome o : list) {
            String k = fn.apply(o);
            if (k == null || k.isBlank()) continue;
            int[] c = counts.computeIfAbsent(k, x -> new int[2]);
            if ("WIN".equals(o.getOutcome())) c[0]++;
            else if ("LOSS".equals(o.getOutcome())) c[1]++;
        }
        return counts.entrySet().stream()
                .filter(e -> e.getValue()[0] + e.getValue()[1] >= 2)
                .sorted((a, b) -> {
                    double ra = rate(a.getValue());
                    double rb = rate(b.getValue());
                    return best ? Double.compare(rb, ra) : Double.compare(ra, rb);
                })
                .map(Map.Entry::getKey)
                .findFirst().orElse(null);
    }

    private double rate(int[] c) {
        int t = c[0] + c[1];
        return t > 0 ? (double) c[0] / t : 0;
    }

    private Double avg(List<Double> vals) {
        if (vals.isEmpty()) return null;
        return Math.round(vals.stream().mapToDouble(Double::doubleValue).average().orElse(0) * 1000) / 1000.0;
    }

    private SetupStatisticsDto emptyStats(String setup, int days) {
        return SetupStatisticsDto.builder()
                .setupType(setup)
                .lookbackDays(days)
                .sampleSize(0)
                .winRate(0)
                .insights(List.of("Insufficient outcome data — log trades or run replay backfill"))
                .build();
    }

    public static String normalize(String setup) {
        if (setup == null) return "UNKNOWN";
        return setup.toUpperCase(Locale.ROOT);
    }
}
