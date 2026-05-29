package com.tradingbot.tradingview.ingestion;

import com.tradingbot.tradingview.TradingViewProperties;
import com.tradingbot.tradingview.dto.TradingViewWebhookPayload;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/** Phase 217 — dedupe repeated Pine alerts. */
@Component
@RequiredArgsConstructor
@EnableConfigurationProperties(TradingViewProperties.class)
public class TradingViewAlertThrottler {

    private final TradingViewProperties properties;
    private final Map<String, Long> lastAcceptedMs = new ConcurrentHashMap<>();
    private final AtomicInteger dedupedCount = new AtomicInteger();

    public boolean shouldAccept(TradingViewWebhookPayload payload) {
        if (payload.symbol() == null || payload.symbol().isBlank()) {
            return false;
        }
        String fingerprint = fingerprint(payload);
        long now = System.currentTimeMillis();
        long windowMs = properties.getThrottleSeconds() * 1000L;
        Long prev = lastAcceptedMs.get(fingerprint);
        if (prev != null && now - prev < windowMs) {
            dedupedCount.incrementAndGet();
            return false;
        }
        lastAcceptedMs.put(fingerprint, now);
        if (lastAcceptedMs.size() > 10_000) {
            prune(now, windowMs * 4);
        }
        return true;
    }

    public int dedupedCount() {
        return dedupedCount.get();
    }

    private static String fingerprint(TradingViewWebhookPayload p) {
        int domBucket = p.dominance() != null ? p.dominance() / 10 : 0;
        return String.join("|",
                p.symbol().toUpperCase(),
                nz(p.direction()),
                nz(p.lifecycle()),
                nz(p.putGrade()),
                String.valueOf(domBucket),
                nz(p.regime()));
    }

    private void prune(long now, long maxAgeMs) {
        lastAcceptedMs.entrySet().removeIf(e -> now - e.getValue() > maxAgeMs);
    }

    private static String nz(String s) {
        return s == null ? "" : s.trim().toUpperCase();
    }
}
