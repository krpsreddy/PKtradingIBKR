package com.tradingbot.intelligence;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.models.SignalOutcome;
import com.tradingbot.repository.SignalOutcomeRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class MarketMemoryService {

    private final SignalOutcomeRepository outcomeRepository;
    private final EmergingSetupService emergingSetupService;
    private final TradingProperties tradingProperties;

    public MarketMemoryDto todayMemory() {
        return buildMemory(MarketTime.nowLocal().toLocalDate(), 1);
    }

    public MarketMemoryDto expandedMemory(int lookbackDays) {
        return buildMemory(MarketTime.nowLocal().toLocalDate(), lookbackDays);
    }

    private MarketMemoryDto buildMemory(LocalDate anchor, int lookbackDays) {
        LocalDate since = anchor.minusDays(lookbackDays);
        List<SignalOutcome> outcomes = outcomeRepository.findSince(since);

        Map<String, int[]> setupCounts = new HashMap<>();
        Map<String, int[]> regimeCounts = new HashMap<>();
        int middayLosses = 0, middayTotal = 0;
        int fakeBreakouts = 0, breakoutTotal = 0;
        int closeWins = 0, closeTotal = 0;

        for (SignalOutcome o : outcomes) {
            if (o.getSetupType() != null) {
                int[] c = setupCounts.computeIfAbsent(o.getSetupType(), k -> new int[2]);
                if ("WIN".equals(o.getOutcome())) c[0]++;
                else if ("LOSS".equals(o.getOutcome())) c[1]++;
            }
            if (o.getRegime() != null && o.getSetupType() != null) {
                String rk = o.getSetupType() + "|" + o.getRegime();
                int[] rc = regimeCounts.computeIfAbsent(rk, k -> new int[2]);
                if ("WIN".equals(o.getOutcome())) rc[0]++;
                else if ("LOSS".equals(o.getOutcome())) rc[1]++;
            }
            if ("MIDDAY".equals(o.getTimeOfDay())) {
                middayTotal++;
                if ("LOSS".equals(o.getOutcome())) middayLosses++;
            }
            if (o.getSetupType() != null && o.getSetupType().contains("OPEN_MOM")) {
                breakoutTotal++;
                if ("LOSS".equals(o.getOutcome())) fakeBreakouts++;
            }
            if ("AFTERNOON".equals(o.getTimeOfDay())) {
                closeTotal++;
                if ("WIN".equals(o.getOutcome())) closeWins++;
            }
        }

        List<String> strongest = new ArrayList<>();
        List<String> failing = new ArrayList<>();
        setupCounts.forEach((setup, c) -> {
            int total = c[0] + c[1];
            if (total < 2) return;
            double wr = (double) c[0] / total;
            if (wr >= 0.6) strongest.add(setup);
            if (wr <= 0.35) failing.add(setup);
        });

        Map<String, Double> regimeWinRates = new LinkedHashMap<>();
        regimeCounts.forEach((key, c) -> {
            int total = c[0] + c[1];
            if (total >= 3) regimeWinRates.put(key, Math.round((double) c[0] / total * 1000) / 1000.0);
        });

        List<String> narratives = buildNarratives(lookbackDays, strongest, failing, setupCounts, outcomes,
                fakeBreakouts, breakoutTotal);

        long emerging = emergingSetupService.scanEmergingSetups().size();

        return MarketMemoryDto.builder()
                .sessionDate(anchor.toString())
                .strongestSetups(strongest)
                .failingSetups(failing)
                .openMomentumSuccessRate(rateForPrefix(setupCounts, "OPEN"))
                .continuationSuccessRate(rateForPrefix(setupCounts, "CONT"))
                .emergingSetupCount((int) emerging)
                .narratives(narratives)
                .regimeSetupWinRates(regimeWinRates)
                .fakeBreakoutFrequency(breakoutTotal > 0 ? (double) fakeBreakouts / breakoutTotal : null)
                .middayDeteriorationRate(middayTotal > 0 ? (double) middayLosses / middayTotal : null)
                .closeStrengthRate(closeTotal > 0 ? (double) closeWins / closeTotal : null)
                .lookbackDays(lookbackDays)
                .build();
    }

    private List<String> buildNarratives(int days, List<String> strongest, List<String> failing,
                                         Map<String, int[]> setupCounts, List<SignalOutcome> outcomes,
                                         int fakeBreakouts, int breakoutTotal) {
        List<String> lines = new ArrayList<>();
        Double cont = rateForPrefix(setupCounts, "CONT");
        Double open = rateForPrefix(setupCounts, "OPEN");
        if (cont != null && cont >= 0.6) {
            lines.add("Continuation setups strengthened over last " + days + " sessions.");
        } else if (cont != null && cont < 0.4) {
            lines.add("Continuation setups weakened after mid-morning historically.");
        }
        if (open != null && open < 0.4) {
            lines.add("Opening momentum failed frequently in recent sessions.");
        }
        if (!strongest.isEmpty()) {
            lines.add(String.join(", ", strongest.stream().limit(2).toList()) + " outperforming over " + days + "d.");
        }
        if (!failing.isEmpty()) {
            lines.add("Avoid " + failing.get(0) + " — underperforming in rolling window.");
        }
        long late = outcomes.stream()
                .filter(o -> "LATE".equals(o.getEntryQuality()) || "CHASING".equals(o.getEntryQuality()))
                .count();
        if (late >= 3) {
            lines.add("Late entries underperforming across " + days + "-day window.");
        }

        Map<String, int[]> timeOfDay = new HashMap<>();
        for (SignalOutcome o : outcomes) {
            if (o.getTimeOfDay() == null || o.getSetupType() == null) continue;
            int[] c = timeOfDay.computeIfAbsent(o.getTimeOfDay() + "|CONT", k -> new int[2]);
            if (o.getSetupType().contains("CONT")) {
                if ("WIN".equals(o.getOutcome())) c[0]++;
                else if ("LOSS".equals(o.getOutcome())) c[1]++;
            }
        }
        timeOfDay.forEach((key, c) -> {
            int total = c[0] + c[1];
            if (total >= 3 && (double) c[0] / total >= 0.65) {
                lines.add("Time-of-day continuation strong in " + key.split("\\|")[0] + ".");
            }
        });

        if (outcomes.stream().filter(o -> o.getSector() != null).count() >= 5) {
            Map<String, int[]> sectors = new HashMap<>();
            for (SignalOutcome o : outcomes) {
                if (o.getSector() == null) continue;
                int[] s = sectors.computeIfAbsent(o.getSector(), k -> new int[2]);
                if ("WIN".equals(o.getOutcome())) s[0]++;
                else if ("LOSS".equals(o.getOutcome())) s[1]++;
            }
            sectors.entrySet().stream()
                    .filter(e -> e.getValue()[0] + e.getValue()[1] >= 3)
                    .max(java.util.Comparator.comparingDouble(e -> (double) e.getValue()[0] / (e.getValue()[0] + e.getValue()[1])))
                    .ifPresent(e -> lines.add(e.getKey() + " sector showing persistence over " + days + "d."));
        }

        if (fakeBreakouts > 0 && breakoutTotal > 0 && (double) fakeBreakouts / breakoutTotal > 0.45) {
            lines.add("Fake breakout signatures elevated — wait for volume confirmation.");
        }
        if (lines.isEmpty()) {
            lines.add("Building multi-session memory — log outcomes to enrich statistics.");
        }
        return lines;
    }

    private Double rateForPrefix(Map<String, int[]> counts, String prefix) {
        int wins = 0, total = 0;
        for (Map.Entry<String, int[]> e : counts.entrySet()) {
            if (!e.getKey().toUpperCase().contains(prefix)) continue;
            wins += e.getValue()[0];
            total += e.getValue()[0] + e.getValue()[1];
        }
        return total > 0 ? Math.round((double) wins / total * 100) / 100.0 : null;
    }
}
