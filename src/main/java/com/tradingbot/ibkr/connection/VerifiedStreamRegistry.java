package com.tradingbot.ibkr.connection;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Phase 216 — only streams that received ticks count as active (no ghost subscriptions).
 */
@Slf4j
@Component
public class VerifiedStreamRegistry {

    public record StreamHeartbeat(
            String symbol,
            long subscribedAtMs,
            long lastTickMs,
            long lastVolumeMs,
            double lastPrice,
            boolean pendingVerification,
            boolean verified,
            StreamTickHealth health
    ) {}

    private final Map<String, StreamHeartbeat> bySymbol = new ConcurrentHashMap<>();
    private volatile long lastSuccessfulTickMs;
    private volatile long totalReconnectAttempts;

    public void onSubscribeRequested(String symbol) {
        if (symbol == null) {
            return;
        }
        String sym = symbol.toUpperCase(Locale.US);
        long now = System.currentTimeMillis();
        bySymbol.put(sym, new StreamHeartbeat(
                sym, now, 0, 0, 0,
                true, false, StreamTickHealth.PENDING));
    }

    public void onUnsubscribed(String symbol) {
        if (symbol != null) {
            bySymbol.remove(symbol.toUpperCase(Locale.US));
        }
    }

    public void recordTick(String symbol, double price, long epochMs) {
        if (symbol == null || epochMs <= 0) {
            return;
        }
        String sym = symbol.toUpperCase(Locale.US);
        lastSuccessfulTickMs = Math.max(lastSuccessfulTickMs, epochMs);
        bySymbol.compute(sym, (k, prev) -> {
            long subAt = prev != null ? prev.subscribedAtMs() : epochMs;
            long volMs = prev != null ? prev.lastVolumeMs() : 0;
            return new StreamHeartbeat(
                    sym, subAt, epochMs, volMs, price,
                    false, true, classify(epochMs));
        });
    }

    public void recordVolume(String symbol, long epochMs) {
        if (symbol == null) {
            return;
        }
        String sym = symbol.toUpperCase(Locale.US);
        bySymbol.computeIfPresent(sym, (k, prev) -> new StreamHeartbeat(
                sym, prev.subscribedAtMs(), prev.lastTickMs(), epochMs, prev.lastPrice(),
                prev.pendingVerification(), prev.verified(), prev.health()));
    }

    public int verifiedCount() {
        return (int) bySymbol.values().stream().filter(StreamHeartbeat::verified).count();
    }

    public List<String> verifiedSymbols() {
        return bySymbol.values().stream()
                .filter(StreamHeartbeat::verified)
                .map(StreamHeartbeat::symbol)
                .sorted()
                .toList();
    }

    public List<String> staleSymbols(long staleMs, long deadMs) {
        long now = System.currentTimeMillis();
        List<String> out = new ArrayList<>();
        for (StreamHeartbeat h : bySymbol.values()) {
            if (!h.verified() && h.pendingVerification()) {
                continue;
            }
            long age = h.lastTickMs() > 0 ? now - h.lastTickMs() : now - h.subscribedAtMs();
            if (age >= staleMs && age < deadMs) {
                out.add(h.symbol());
            }
        }
        return out;
    }

    public List<String> deadSymbols(long deadMs) {
        long now = System.currentTimeMillis();
        List<String> out = new ArrayList<>();
        for (StreamHeartbeat h : bySymbol.values()) {
            long age = h.lastTickMs() > 0 ? now - h.lastTickMs() : now - h.subscribedAtMs();
            if (age >= deadMs) {
                out.add(h.symbol());
            }
        }
        return out;
    }

    public List<String> pendingVerificationPast(long verifyTimeoutMs) {
        long now = System.currentTimeMillis();
        return bySymbol.values().stream()
                .filter(h -> h.pendingVerification() && !h.verified()
                        && now - h.subscribedAtMs() > verifyTimeoutMs)
                .map(StreamHeartbeat::symbol)
                .toList();
    }

    public void clearGhost(String symbol) {
        bySymbol.remove(symbol.toUpperCase(Locale.US));
    }

    public void clearAll() {
        bySymbol.clear();
        lastSuccessfulTickMs = 0;
    }

    public long lastSuccessfulTickMs() {
        return lastSuccessfulTickMs;
    }

    public long avgTickLatencyMs() {
        long now = System.currentTimeMillis();
        List<Long> ages = bySymbol.values().stream()
                .filter(StreamHeartbeat::verified)
                .map(h -> now - h.lastTickMs())
                .filter(a -> a >= 0 && a < 120_000)
                .toList();
        if (ages.isEmpty()) {
            return -1;
        }
        return ages.stream().mapToLong(Long::longValue).sum() / ages.size();
    }

    public int streamHealthScore() {
        int verified = verifiedCount();
        if (verified == 0) {
            return 0;
        }
        long now = System.currentTimeMillis();
        int live = 0;
        for (StreamHeartbeat h : bySymbol.values()) {
            if (h.verified() && h.lastTickMs() > 0 && now - h.lastTickMs() < 15_000) {
                live++;
            }
        }
        return Math.min(100, (live * 100) / Math.max(1, verified));
    }

    public void incrementReconnectAttempts() {
        totalReconnectAttempts++;
    }

    public long reconnectAttempts() {
        return totalReconnectAttempts;
    }

    public Map<String, StreamHeartbeat> snapshot() {
        return Map.copyOf(bySymbol);
    }

    private static StreamTickHealth classify(long lastTickMs) {
        long age = System.currentTimeMillis() - lastTickMs;
        if (age < 15_000) {
            return StreamTickHealth.LIVE;
        }
        if (age < 60_000) {
            return StreamTickHealth.DEGRADED;
        }
        if (age < 120_000) {
            return StreamTickHealth.STALE;
        }
        return StreamTickHealth.DEAD;
    }

    public StreamTickHealth healthFor(String symbol) {
        StreamHeartbeat h = bySymbol.get(symbol.toUpperCase(Locale.US));
        if (h == null) {
            return StreamTickHealth.DEAD;
        }
        if (h.lastTickMs() > 0) {
            return classify(h.lastTickMs());
        }
        return h.pendingVerification() ? StreamTickHealth.PENDING : StreamTickHealth.DEAD;
    }
}
