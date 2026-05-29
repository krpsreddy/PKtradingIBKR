package com.tradingbot.tradingview.ranking;

import com.tradingbot.tradingview.TradingViewProperties;
import com.tradingbot.tradingview.dto.TradingViewDirection;
import com.tradingbot.tradingview.dto.TradingViewFeedDto;
import com.tradingbot.tradingview.dto.TradingViewHealthDto;
import com.tradingbot.tradingview.dto.TradingViewSignalDto;
import com.tradingbot.tradingview.ingestion.TradingViewAlertThrottler;
import com.tradingbot.tradingview.state.TradingViewSignalStore;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** Phase 217 — global TV intelligence ranking (secondary feed). */
@Service
@RequiredArgsConstructor
@EnableConfigurationProperties(TradingViewProperties.class)
public class TradingViewRankingEngine {

    private final TradingViewProperties properties;
    private final TradingViewSignalStore store;
    private final TradingViewAlertThrottler throttler;

    public TradingViewFeedDto buildFeed() {
        List<TradingViewSignalDto> active = store.activeSignals().stream()
                .filter(s -> !s.stale())
                .toList();
        int limit = properties.getTopListSize();
        long now = System.currentTimeMillis();

        List<TradingViewSignalDto> bullish = active.stream()
                .filter(s -> s.direction() == TradingViewDirection.BULLISH)
                .sorted(Comparator.comparingInt(TradingViewSignalDto::dominance).reversed())
                .limit(limit)
                .toList();

        List<TradingViewSignalDto> bearish = active.stream()
                .filter(s -> s.direction() == TradingViewDirection.BEARISH || s.bearishBias() >= 40)
                .sorted(Comparator.comparingInt(TradingViewSignalDto::bearishBias).reversed()
                        .thenComparing(Comparator.comparingInt(TradingViewSignalDto::dominance).reversed()))
                .limit(limit)
                .toList();

        List<TradingViewSignalDto> putAssist = active.stream()
                .filter(s -> s.putGrade() != null && !"NONE".equalsIgnoreCase(s.putGrade()))
                .sorted(Comparator.comparingInt(TradingViewSignalDto::bearishBias).reversed())
                .limit(limit)
                .toList();

        List<TradingViewSignalDto> persistence = active.stream()
                .sorted(Comparator.comparingInt(TradingViewSignalDto::persistence).reversed())
                .limit(limit)
                .toList();

        List<TradingViewSignalDto> continuation = active.stream()
                .sorted(Comparator.comparingDouble(TradingViewSignalDto::rvol).reversed()
                        .thenComparing(Comparator.comparingInt(TradingViewSignalDto::dominance).reversed()))
                .limit(limit)
                .toList();

        List<TradingViewSignalDto> conflict = active.stream()
                .filter(s -> isHighConflict(s))
                .limit(limit)
                .toList();

        List<TradingViewSignalDto> collapsing = active.stream()
                .filter(this::isCollapsing)
                .limit(limit)
                .toList();

        int staleCount = (int) store.activeSignals().stream().filter(TradingViewSignalDto::stale).count();
        long last = store.lastSignalAtMs();
        TradingViewHealthDto health = new TradingViewHealthDto(
                last,
                active.size(),
                staleCount,
                throttler.dedupedCount(),
                last > 0 && now - last < properties.getStaleMinutes() * 60_000L
        );

        return new TradingViewFeedDto(
                now,
                health,
                bullish,
                bearish,
                putAssist,
                persistence,
                continuation,
                conflict,
                collapsing
        );
    }

    private boolean isHighConflict(TradingViewSignalDto s) {
        String c = s.conflictLevel() == null ? "" : s.conflictLevel().toUpperCase(Locale.US);
        return c.contains("HIGH") || c.contains("CONFLICT") || c.contains("OPPOSE");
    }

    private boolean isCollapsing(TradingViewSignalDto s) {
        String lc = s.lifecycle() == null ? "" : s.lifecycle().toUpperCase(Locale.US);
        String det = s.deterioration() == null ? "" : s.deterioration().toUpperCase(Locale.US);
        return lc.contains("EXHAUST") || lc.contains("FAIL") || lc.contains("COLLAPSE")
                || det.contains("COLLAPSE") || det.contains("DETERIOR");
    }
}
