package com.tradingbot.replay.cache;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.historical.CandleHistoryService;
import com.tradingbot.replay.HistoricalReplayEngine;
import com.tradingbot.replay.cache.dto.ReplayCacheDtos.SymbolSnapshotPageDto;
import com.tradingbot.replay.cache.entity.ReplaySessionSnapshotEntity;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Fast snapshot loading queries. */
@Service
@RequiredArgsConstructor
public class ReplayCacheQueryService {

    private final ReplaySnapshotService snapshotService;
    private final ReplayStalenessService stalenessService;
    private final CandleHistoryService candleHistoryService;
    private final HistoricalReplayEngine replayEngine;
    private final TradingProperties tradingProperties;

    public SymbolSnapshotPageDto snapshotSummary(String symbol, int days) {
        String sym = symbol.toUpperCase();
        int window = days > 0 ? days : tradingProperties.getHistoricalLookbackDays();
        LocalDate cutoff = MarketTime.nowLocal().toLocalDate().minusDays(window);

        List<LocalDate> dates = replayEngine.availableDates(sym, cutoff);
        var allCandles = candleHistoryService.loadSessionCandles(sym);
        Map<LocalDate, ReplaySessionSnapshotEntity> snapshots = snapshotService.loadSnapshotMap(sym, cutoff);

        Map<LocalDate, String> hashes = new HashMap<>();
        for (LocalDate date : dates) {
            hashes.put(date, stalenessService.computeCandlesHash(
                    stalenessService.filterSessionBars(allCandles, date)));
        }

        return snapshotService.summarize(sym, dates, snapshots, hashes);
    }
}
