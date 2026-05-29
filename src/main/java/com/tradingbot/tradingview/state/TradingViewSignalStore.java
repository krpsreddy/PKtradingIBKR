package com.tradingbot.tradingview.state;

import com.tradingbot.tradingview.TradingViewProperties;
import com.tradingbot.tradingview.dto.TradingViewDirection;
import com.tradingbot.tradingview.dto.TradingViewSignalDto;
import com.tradingbot.tradingview.dto.TradingViewWebhookPayload;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** Phase 217 — rolling active TV intelligence with auto-expiry. */
@Component
@RequiredArgsConstructor
@EnableConfigurationProperties(TradingViewProperties.class)
public class TradingViewSignalStore {

    private final TradingViewProperties properties;
    private final Map<String, TradingViewSignalRecord> byKey = new ConcurrentHashMap<>();
    private final AtomicLong lastSignalAtMs = new AtomicLong(0);

    public TradingViewSignalDto upsert(TradingViewWebhookPayload payload) {
        String sym = payload.symbol().trim().toUpperCase(Locale.US);
        TradingViewDirection direction = TradingViewDirection.parse(payload.direction());
        long sourceTs = payload.timestamp() != null && payload.timestamp() > 0
                ? payload.timestamp()
                : System.currentTimeMillis();
        long now = System.currentTimeMillis();

        TradingViewSignalDto signal = TradingViewSignalDto.fresh(
                sym,
                direction,
                clamp(payload.dominance()),
                clamp(payload.conviction()),
                clamp(payload.persistence()),
                payload.rvol() != null ? payload.rvol() : 0,
                nz(payload.lifecycle(), "DEVELOPING"),
                nz(payload.regime(), "UNKNOWN"),
                nz(payload.executionQuality(), "MEDIUM"),
                payload.bearishBias() != null ? payload.bearishBias() : 0,
                nz(payload.putGrade(), "NONE"),
                nz(payload.deterioration(), ""),
                nz(payload.conflictLevel(), ""),
                nz(payload.pmState(), ""),
                sourceTs,
                now
        );

        String key = TradingViewSignalRecord.keyFor(sym, direction);
        byKey.put(key, new TradingViewSignalRecord(key, signal, now));
        lastSignalAtMs.set(now);
        trimIfNeeded();
        return signal;
    }

    public List<TradingViewSignalDto> activeSignals() {
        long staleMs = properties.getStaleMinutes() * 60_000L;
        long now = System.currentTimeMillis();
        List<TradingViewSignalDto> out = new ArrayList<>();
        for (TradingViewSignalRecord rec : byKey.values()) {
            boolean stale = now - rec.lastUpdatedMs() > staleMs;
            TradingViewSignalDto s = rec.signal();
            out.add(new TradingViewSignalDto(
                    s.symbol(),
                    s.direction(),
                    s.dominance(),
                    s.conviction(),
                    s.persistence(),
                    s.rvol(),
                    s.lifecycle(),
                    s.regime(),
                    s.executionQuality(),
                    s.bearishBias(),
                    s.putGrade(),
                    s.deterioration(),
                    s.conflictLevel(),
                    s.pmState(),
                    s.sourceTimestamp(),
                    s.receivedAtMs(),
                    stale,
                    s.source()
            ));
        }
        return out;
    }

    public long lastSignalAtMs() {
        return lastSignalAtMs.get();
    }

    public int size() {
        return byKey.size();
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void expireStale() {
        long staleMs = properties.getStaleMinutes() * 60_000L;
        long now = System.currentTimeMillis();
        byKey.entrySet().removeIf(e -> now - e.getValue().lastUpdatedMs() > staleMs);
    }

    private void trimIfNeeded() {
        int max = properties.getMaxStoredSignals();
        if (byKey.size() <= max) {
            return;
        }
        byKey.entrySet().stream()
                .sorted((a, b) -> Long.compare(a.getValue().lastUpdatedMs(), b.getValue().lastUpdatedMs()))
                .limit(byKey.size() - max)
                .map(Map.Entry::getKey)
                .toList()
                .forEach(byKey::remove);
    }

    private static int clamp(Integer v) {
        return v == null ? 0 : Math.max(0, Math.min(999, v));
    }

    private static String nz(String v, String def) {
        return v == null || v.isBlank() ? def : v.trim();
    }
}
