package com.tradingbot.replay.cache;

import com.tradingbot.api.dto.BulkReplayHistoryDto;
import com.tradingbot.api.dto.ReplayHistoryDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.historical.CandleHistoryService;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.Candle;
import com.tradingbot.models.TradingSymbol;
import com.tradingbot.replay.HistoricalReplayEngine;
import com.tradingbot.replay.cache.dto.ReplayCacheDtos.IncrementalReplayResultDto;
import com.tradingbot.replay.cache.dto.ReplayCacheDtos.StaleSessionsDto;
import com.tradingbot.replay.cache.entity.ReplaySessionSnapshotEntity;
import com.tradingbot.services.MarketTime;
import com.tradingbot.services.SymbolLoadService;
import com.tradingbot.services.TradingSymbolService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Cache-first incremental replay — only recomputes stale or missing sessions. */
@Service
@RequiredArgsConstructor
@Slf4j
public class IncrementalReplayService {

    private final HistoricalReplayEngine replayEngine;
    private final CandleHistoryService candleHistoryService;
    private final ReplaySnapshotService snapshotService;
    private final ReplayStalenessService stalenessService;
    private final SymbolLoadService symbolLoadService;
    private final TradingSymbolService tradingSymbolService;
    private final TradingProperties tradingProperties;

    public StaleSessionsDto staleSessions(String symbol, int days) {
        String sym = symbol.toUpperCase();
        int window = days > 0 ? days : tradingProperties.getHistoricalLookbackDays();
        LocalDate cutoff = MarketTime.nowLocal().toLocalDate().minusDays(window);

        List<LocalDate> dates = replayEngine.availableDates(sym, cutoff);
        List<Candle> allCandles = candleHistoryService.loadSessionCandles(sym);
        Map<LocalDate, ReplaySessionSnapshotEntity> snapshots = snapshotService.loadSnapshotMap(sym, cutoff);

        List<String> stale = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        int ready = 0;

        for (LocalDate date : dates) {
            List<Candle> sessionBars = stalenessService.filterSessionBars(allCandles, date);
            String hash = stalenessService.computeCandlesHash(sessionBars);
            ReplaySessionSnapshotEntity snap = snapshots.get(date);
            if (snap == null) {
                missing.add(date.toString());
            } else if (!stalenessService.isSnapshotFresh(snap, hash)) {
                stale.add(date.toString());
            } else {
                ready++;
            }
        }

        return new StaleSessionsDto(sym, stalenessService.currentAnalyticsVersion(),
                stale, missing, ready);
    }

    public IncrementalReplayResultDto incrementalReplay(String symbol, int days, String timeframe, boolean force) {
        String sym = symbol.toUpperCase();
        String tf = timeframe != null ? timeframe : tradingProperties.getTimeframe();
        int window = days > 0 ? days : tradingProperties.getHistoricalLookbackDays();
        LocalDate cutoff = MarketTime.nowLocal().toLocalDate().minusDays(window);

        symbolLoadService.activateSymbol(sym);
        long stored = candleHistoryService.storedBarCount(sym);

        List<LocalDate> dates = replayEngine.availableDates(sym, cutoff);
        if (dates.isEmpty()) {
            String message = stored == 0
                    ? "No candles stored for " + sym
                    : "No regular-session dates in " + window + "D window";
            return emptyResult(sym, window, (int) stored, message, stored == 0 ? "NO_CANDLES" : "NO_SESSIONS");
        }

        List<Candle> allCandles = candleHistoryService.loadSessionCandles(sym);
        Long avgDailyVol = tradingSymbolService.findActive(sym)
                .map(TradingSymbol::getAvgDailyVolume)
                .orElse(null);

        Map<LocalDate, ReplaySessionSnapshotEntity> snapshots = force
                ? Map.of()
                : snapshotService.loadSnapshotMap(sym, cutoff);

        List<ReplayHistoryDto> sessions = new ArrayList<>();
        int fromCache = 0;
        int replayed = 0;
        int totalSignals = 0;
        int withSignals = 0;

        for (LocalDate date : dates) {
            List<Candle> sessionBars = stalenessService.filterSessionBars(allCandles, date);
            String hash = stalenessService.computeCandlesHash(sessionBars);

            if (!force) {
                ReplaySessionSnapshotEntity existing = snapshots.get(date);
                if (stalenessService.isSnapshotFresh(existing, hash)) {
                    ReplayHistoryDto cached = snapshotService.loadSession(sym, date).orElse(null);
                    if (cached != null) {
                        sessions.add(cached);
                        fromCache++;
                        if (cached.getSimulatedSignals() > 0) {
                            withSignals++;
                            totalSignals += cached.getSimulatedSignals();
                        }
                        continue;
                    }
                }
            }

            long started = System.currentTimeMillis();
            HistoricalReplayEngine.ReplaySessionResult result =
                    replayEngine.replaySession(sym, date, tf, allCandles, avgDailyVol);
            long duration = System.currentTimeMillis() - started;

            ReplayHistoryDto session = result.session();
            sessions.add(session);
            replayed++;

            snapshotService.persistSession(session, hash, result.lastIndicator(), duration);

            if (session.getSimulatedSignals() > 0) {
                withSignals++;
                totalSignals += session.getSimulatedSignals();
            }
        }

        String message = fromCache > 0 && replayed == 0
                ? fromCache + " sessions loaded from replay cache"
                : replayed + " sessions replayed, " + fromCache + " from cache";

        log.info("Incremental replay {} — cache={} replayed={} total={}", sym, fromCache, replayed, sessions.size());

        return new IncrementalReplayResultDto(
                sym, window, sessions.size(), fromCache, replayed,
                withSignals, totalSignals, (int) stored,
                "READY", message, sessions);
    }

    public BulkReplayHistoryDto toBulkDto(IncrementalReplayResultDto result) {
        return BulkReplayHistoryDto.builder()
                .symbol(result.symbol())
                .lookbackDays(result.lookbackDays())
                .sessionsProcessed(result.sessionsProcessed())
                .sessionsWithSignals(result.sessionsWithSignals())
                .totalSignals(result.totalSignals())
                .candlesStored(result.candlesStored())
                .historyStatus(result.historyStatus())
                .historyMessage(result.historyMessage())
                .sessions(result.sessions())
                .build();
    }

    private IncrementalReplayResultDto emptyResult(String sym, int window, int stored,
                                                   String message, String status) {
        return new IncrementalReplayResultDto(
                sym, window, 0, 0, 0, 0, 0, stored, status, message, List.of());
    }
}
