package com.tradingbot.intelligence;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.models.SignalOutcome;
import com.tradingbot.repository.SignalOutcomeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdaptiveRankingService {

    private final SignalOutcomeRepository outcomeRepository;
    private final TradingProperties tradingProperties;
    private volatile Map<String, Integer> adjustmentCache = Map.of();
    private volatile long cacheTs;

    public int adjustScore(String signalType, String regime, String sector, int baseScore) {
        refreshCacheIfNeeded();
        int adj = 0;
        adj += adjustmentCache.getOrDefault(key(signalType, regime), 0);
        if (sector != null) {
            adj += adjustmentCache.getOrDefault(key(signalType, sector), 0);
        }
        adj += regimeHeuristic(signalType, regime);
        return Math.max(0, Math.min(100, baseScore + adj));
    }

    private int regimeHeuristic(String signalType, String regime) {
        if (signalType == null || regime == null) return 0;
        String s = signalType.toUpperCase();
        if (s.contains("CONT") && "TRENDING_BULL".equals(regime)) return 10;
        if (s.contains("CONT") && "CHOPPY".equals(regime)) return -15;
        if (s.contains("OPEN_MOM") && "CHOPPY".equals(regime)) return -12;
        if (s.contains("OPEN_MOM") && "TRENDING_BULL".equals(regime)) return 8;
        if (s.contains("FAIL") && ("CHOPPY".equals(regime) || "TRENDING_BEAR".equals(regime))) return 10;
        if (s.contains("FAIL") && "TRENDING_BULL".equals(regime)) return -8;
        return 0;
    }

    public double winRate(String signalType, String regime) {
        refreshCacheIfNeeded();
        return rateFromCache(signalType, regime);
    }

    private void refreshCacheIfNeeded() {
        if (System.currentTimeMillis() - cacheTs < 60_000) return;
        LocalDate since = LocalDate.now().minusDays(tradingProperties.getIntelligenceLookbackDays());
        List<Object[]> rows = outcomeRepository.aggregateBySetupRegime(since);
        Map<String, int[]> counts = new HashMap<>();
        for (Object[] row : rows) {
            String setup = (String) row[0];
            String regime = row[1] != null ? (String) row[1] : "UNKNOWN";
            String outcome = (String) row[2];
            long cnt = (Long) row[3];
            String k = key(setup, regime);
            int[] c = counts.computeIfAbsent(k, x -> new int[2]);
            if ("WIN".equals(outcome)) c[0] += (int) cnt;
            else if ("LOSS".equals(outcome)) c[1] += (int) cnt;
        }
        Map<String, Integer> adj = new HashMap<>();
        counts.forEach((k, c) -> {
            int total = c[0] + c[1];
            if (total < 5) return;
            double wr = (double) c[0] / total;
            if (wr >= 0.65) adj.put(k, 8);
            else if (wr >= 0.55) adj.put(k, 4);
            else if (wr <= 0.35) adj.put(k, -12);
            else if (wr <= 0.45) adj.put(k, -6);
        });
        adjustmentCache = adj;
        cacheTs = System.currentTimeMillis();
    }

    private double rateFromCache(String signalType, String regime) {
        LocalDate since = LocalDate.now().minusDays(tradingProperties.getIntelligenceLookbackDays());
        List<Object[]> rows = outcomeRepository.aggregateBySetupRegime(since);
        int wins = 0, total = 0;
        for (Object[] row : rows) {
            if (!signalType.equals(row[0])) continue;
            if (regime != null && !regime.equals(row[1])) continue;
            if ("WIN".equals(row[2])) wins += ((Long) row[3]).intValue();
            if ("WIN".equals(row[2]) || "LOSS".equals(row[2])) total += ((Long) row[3]).intValue();
        }
        return total > 0 ? Math.round((double) wins / total * 100) : -1;
    }

    private static String key(String a, String b) {
        return (a != null ? a : "") + "|" + (b != null ? b : "");
    }
}
