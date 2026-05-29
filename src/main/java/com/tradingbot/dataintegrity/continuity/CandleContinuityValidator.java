package com.tradingbot.dataintegrity.continuity;

import com.tradingbot.models.Candle;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Phase 212 — validates 5m candle sequences. */
@Component
public class CandleContinuityValidator {

    @Value("${live.integrity.max-candle-gap:1}")
    private int maxAllowedGaps;

    public ContinuityResult validate(List<Candle> candles, int barMinutes) {
        if (candles == null || candles.size() < 2) {
            return new ContinuityResult(true, 100, List.of());
        }
        List<Candle> sorted = candles.stream()
                .sorted(Comparator.comparing(Candle::getOpenTime))
                .toList();
        List<String> issues = new ArrayList<>();
        int gaps = 0;
        int duplicates = 0;
        Candle prev = null;
        for (Candle c : sorted) {
            if (c.getVolume() != null && c.getVolume() == 0) {
                issues.add("Zero volume at " + c.getOpenTime());
            }
            if (prev != null) {
                if (c.getOpenTime().equals(prev.getOpenTime())) {
                    duplicates++;
                } else if (c.getOpenTime().isBefore(prev.getOpenTime())) {
                    issues.add("Out-of-order bar at " + c.getOpenTime());
                } else {
                    long expectedMin = barMinutes;
                    long actual = ChronoUnit.MINUTES.between(prev.getOpenTime(), c.getOpenTime());
                    if (actual > expectedMin) {
                        long missing = (actual / expectedMin) - 1;
                        if (missing > 0) {
                            gaps += (int) missing;
                            issues.add("Missing " + missing + " bar(s) after " + prev.getOpenTime());
                        }
                    }
                }
            }
            prev = c;
        }
        boolean ok = gaps <= maxAllowedGaps && duplicates == 0
                && issues.stream().noneMatch(i -> i.contains("Out-of-order"));
        int score = Math.max(0, 100 - gaps * 25 - duplicates * 15 - issues.size() * 5);
        return new ContinuityResult(ok, score, issues);
    }

    public record ContinuityResult(boolean acceptable, int continuityScore, List<String> issues) {}
}
