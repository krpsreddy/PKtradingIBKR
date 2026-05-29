package com.tradingbot.dataintegrity.staleness;

import com.tradingbot.dataintegrity.integrity.RuntimeIntegrityState;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Phase 212 — frozen price / stale tick / delayed stream detection. */
@Component
public class StaleDataDetector {

    @Value("${live.integrity.max-stale-seconds:10}")
    private int maxStaleSeconds;

    @Value("${live.integrity.max-delayed-seconds:20}")
    private int maxDelayedSeconds;

    private final Map<String, TickSample> lastBySymbol = new ConcurrentHashMap<>();

    public void recordTick(String symbol, double price, long epochMs) {
        if (symbol == null) return;
        String sym = symbol.toUpperCase();
        TickSample prev = lastBySymbol.get(sym);
        boolean frozen = prev != null && Math.abs(prev.price - price) < 0.0001
                && epochMs - prev.epochMs > maxStaleSeconds * 1000L;
        lastBySymbol.put(sym, new TickSample(price, epochMs, frozen));
    }

    public StaleResult assess(String symbol, Long lastTickMs) {
        List<String> issues = new ArrayList<>();
        long now = System.currentTimeMillis();
        if (lastTickMs == null) {
            return new StaleResult(RuntimeIntegrityState.STALE, 20, List.of("No tick timestamp"));
        }
        long ageSec = (now - lastTickMs) / 1000;
        TickSample sample = symbol != null ? lastBySymbol.get(symbol.toUpperCase()) : null;
        if (ageSec > maxStaleSeconds * 3L) {
            issues.add("No tick for " + ageSec + "s");
            return new StaleResult(RuntimeIntegrityState.STALE, 10, issues);
        }
        if (ageSec > maxDelayedSeconds) {
            issues.add("Stream delayed " + ageSec + "s");
            return new StaleResult(RuntimeIntegrityState.STALE, 25, issues);
        }
        if (ageSec > maxStaleSeconds) {
            issues.add("Tick delayed " + ageSec + "s");
            return new StaleResult(RuntimeIntegrityState.DELAYED, 60, issues);
        }
        if (sample != null && sample.frozen) {
            issues.add("Price frozen / dead bid-ask");
            return new StaleResult(RuntimeIntegrityState.STALE, 30, issues);
        }
        return new StaleResult(RuntimeIntegrityState.LIVE, 95, List.of());
    }

    public record TickSample(double price, long epochMs, boolean frozen) {}

    public record StaleResult(RuntimeIntegrityState suggested, int freshnessScore, List<String> issues) {}
}
