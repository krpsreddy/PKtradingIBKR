package com.tradingbot.replay.cache;

import com.tradingbot.analytics.storage.AnalyticsVersionService;
import com.tradingbot.models.Candle;
import com.tradingbot.replay.cache.entity.ReplaySessionSnapshotEntity;
import com.tradingbot.replay.cache.entity.ReplaySessionSnapshotEntity.ReplayStatus;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/** Determine snapshot validity from candles hash and analytics version. */
@Service
@RequiredArgsConstructor
public class ReplayStalenessService {

    private final AnalyticsVersionService versionService;
    private final MarketHoursService marketHoursService;

    public String computeCandlesHash(List<Candle> sessionBars) {
        return ReplayHashUtil.hashSessionCandles(sessionBars);
    }

    public List<Candle> filterSessionBars(List<Candle> allCandles, LocalDate date) {
        return allCandles.stream()
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .filter(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(date))
                .toList();
    }

    public boolean isSnapshotFresh(ReplaySessionSnapshotEntity snapshot, String currentCandlesHash) {
        if (snapshot == null) return false;
        if (snapshot.getReplayStatus() != ReplayStatus.READY) return false;
        if (!versionService.isCompatible(snapshot.getAnalyticsVersion())) return false;
        return snapshot.getCandlesHash().equals(currentCandlesHash);
    }

    public ReplayStatus resolveStatus(ReplaySessionSnapshotEntity existing, String currentCandlesHash) {
        if (existing == null) return null;
        if (!versionService.isCompatible(existing.getAnalyticsVersion())) {
            return ReplayStatus.STALE;
        }
        if (!existing.getCandlesHash().equals(currentCandlesHash)) {
            return ReplayStatus.STALE;
        }
        return existing.getReplayStatus();
    }

    public int currentAnalyticsVersion() {
        return versionService.currentVersion();
    }
}
