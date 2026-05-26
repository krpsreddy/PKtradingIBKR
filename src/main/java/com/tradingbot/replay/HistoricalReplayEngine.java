package com.tradingbot.replay;

import com.tradingbot.historical.CandleHistoryService;
import com.tradingbot.api.dto.CandleChartDto;
import com.tradingbot.api.dto.BulkReplayHistoryDto;
import com.tradingbot.api.dto.ReplayHistoryDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorCalculationService;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.Candle;
import com.tradingbot.models.TradingSymbol;
import com.tradingbot.services.SymbolLoadService;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import com.tradingbot.services.TradingSymbolService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class HistoricalReplayEngine {

    private final IndicatorCalculationService indicatorCalculationService;
    private final ReplayBarEvaluator replayBarEvaluator;
    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;
    private final CandleHistoryService candleHistoryService;
    private final SymbolLoadService symbolLoadService;
    private final TradingSymbolService tradingSymbolService;

    public record ReplaySessionResult(ReplayHistoryDto session, IndicatorResult lastIndicator) {}

    public ReplayHistoryDto replay(String symbol, LocalDate date, String timeframe) {
        String sym = symbol.toUpperCase();
        List<Candle> all = candleHistoryService.loadSessionCandlesUntil(sym, date);
        Long avgDailyVol = tradingSymbolService.findActive(sym)
                .map(TradingSymbol::getAvgDailyVolume)
                .orElse(null);
        return replaySession(sym, date, timeframe, all, avgDailyVol).session();
    }

    /**
     * Replay one session using preloaded candles — O(n) indexed loop (no indexOf).
     */
    public ReplaySessionResult replaySession(String sym, LocalDate date, String timeframe,
                                             List<Candle> allCandles, Long avgDailyVol) {
        String tf = timeframe != null ? timeframe : tradingProperties.getTimeframe();

        int endExclusive = findSessionEndIndex(allCandles, date);
        if (endExclusive <= 0) {
            return new ReplaySessionResult(emptyResult(sym, date, tf), null);
        }

        List<Candle> sessionBars = new ArrayList<>();
        for (int i = 0; i < endExclusive; i++) {
            Candle c = allCandles.get(i);
            if (marketHoursService.isRegularSessionCandle(c.getOpenTime())
                    && MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(date)) {
                sessionBars.add(c);
            }
        }

        if (sessionBars.isEmpty()) {
            log.warn("No session candles for {} on {}", sym, date);
            return new ReplaySessionResult(emptyResult(sym, date, tf), null);
        }

        ReplayContext ctx = new ReplayContext(sym, date, avgDailyVol);
        int minBars = tradingProperties.getMinCandlesForSignals();
        int replayMin = tradingProperties.getReplayMinCandles();
        IndicatorResult lastIndicator = null;

        for (int endIdx = 0; endIdx < endExclusive; endIdx++) {
            Candle sessionBar = allCandles.get(endIdx);
            if (!marketHoursService.isRegularSessionCandle(sessionBar.getOpenTime())) {
                continue;
            }
            if (!MarketTime.toMarketZoned(sessionBar.getOpenTime()).toLocalDate().equals(date)) {
                continue;
            }

            ZonedDateTime barTime = MarketTime.toMarketZoned(sessionBar.getOpenTime());
            boolean openingPhase = marketHoursService.isOpenScoutWindow(barTime)
                    || marketHoursService.isOpenMomentumWindow(barTime)
                    || marketHoursService.isOpenFailWindow(barTime);
            int requiredBars = openingPhase ? replayMin : minBars;
            int visibleSize = endIdx + 1;
            if (visibleSize < requiredBars) {
                continue;
            }

            List<Candle> visible = allCandles.subList(0, visibleSize);
            IndicatorResult ind = indicatorCalculationService.calculateIndicators(
                    new ArrayList<>(visible), requiredBars);
            if (!ind.isValid()) {
                continue;
            }

            lastIndicator = ind;
            ctx.appendCandle(sessionBar);
            replayBarEvaluator.evaluateBar(ctx, ind, avgDailyVol);
        }

        List<CandleChartDto> chartCandles = sessionBars.stream()
                .map(this::toChartDto)
                .toList();

        ReplayHistoryDto dto = ReplayHistoryDto.builder()
                .symbol(sym)
                .replayDate(date.toString())
                .timeframe(tf)
                .totalBars(sessionBars.size())
                .simulatedSignals(ctx.getReplaySignals().size())
                .sessionCandles(chartCandles)
                .timeline(ctx.getReplayTimeline())
                .scoreHistory(ctx.getScoreHistory())
                .lifecyclePath(ctx.lifecyclePathList())
                .build();

        return new ReplaySessionResult(dto, lastIndicator);
    }

    /** Index of first candle AFTER session date (exclusive end for session replay scan). */
    private int findSessionEndIndex(List<Candle> allCandles, LocalDate date) {
        for (int i = allCandles.size() - 1; i >= 0; i--) {
            LocalDate barDate = MarketTime.toMarketZoned(allCandles.get(i).getOpenTime()).toLocalDate();
            if (!barDate.isAfter(date)) {
                return i + 1;
            }
        }
        return 0;
    }

    public List<LocalDate> availableDates(String symbol, LocalDate cutoff) {
        return candleHistoryService.availableReplayDates(symbol).stream()
                .filter(d -> !d.isBefore(cutoff))
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    public LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) {
            return marketHoursService.lastTradingDay();
        }
        try {
            return LocalDate.parse(dateStr);
        } catch (DateTimeParseException e) {
            return marketHoursService.lastTradingDay();
        }
    }

    /**
     * Replay every available session — legacy full replay (prefer incremental via ReplayCacheController).
     */
    public BulkReplayHistoryDto bulkReplay(String symbol, int days, String timeframe) {
        String sym = symbol.toUpperCase();
        String tf = timeframe != null ? timeframe : tradingProperties.getTimeframe();
        int window = days > 0 ? days : tradingProperties.getHistoricalLookbackDays();
        LocalDate cutoff = MarketTime.nowLocal().toLocalDate().minusDays(window);

        symbolLoadService.activateSymbol(sym);
        long stored = candleHistoryService.storedBarCount(sym);

        List<LocalDate> dates = availableDates(sym, cutoff);

        if (dates.isEmpty()) {
            String message = stored == 0
                    ? "No candles stored for " + sym + ". IBKR must be connected to fetch 60D history — use Load 60D History after TWS/Gateway is running."
                    : "Stored " + stored + " bars for " + sym + " but no regular-session dates in the " + window + "D window.";
            log.warn("Bulk replay skipped for {} — {}", sym, message);
            return BulkReplayHistoryDto.builder()
                    .symbol(sym)
                    .lookbackDays(window)
                    .sessionsProcessed(0)
                    .sessionsWithSignals(0)
                    .totalSignals(0)
                    .candlesStored((int) stored)
                    .historyStatus(stored == 0 ? "NO_CANDLES" : "NO_SESSIONS")
                    .historyMessage(message)
                    .sessions(List.of())
                    .build();
        }

        List<Candle> allCandles = candleHistoryService.loadSessionCandles(sym);
        Long avgDailyVol = tradingSymbolService.findActive(sym)
                .map(TradingSymbol::getAvgDailyVolume)
                .orElse(null);

        List<ReplayHistoryDto> sessions = new ArrayList<>();
        int totalSignals = 0;
        int withSignals = 0;

        for (LocalDate date : dates) {
            ReplaySessionResult result = replaySession(sym, date, tf, allCandles, avgDailyVol);
            ReplayHistoryDto session = result.session();
            sessions.add(session);
            if (session.getSimulatedSignals() > 0) {
                withSignals++;
                totalSignals += session.getSimulatedSignals();
            }
        }

        log.info("Bulk replay {} — {} sessions, {} signals", sym, sessions.size(), totalSignals);

        return BulkReplayHistoryDto.builder()
                .symbol(sym)
                .lookbackDays(window)
                .sessionsProcessed(sessions.size())
                .sessionsWithSignals(withSignals)
                .totalSignals(totalSignals)
                .candlesStored((int) candleHistoryService.storedBarCount(sym))
                .historyStatus("READY")
                .historyMessage(sessions.size() + " sessions replayed")
                .sessions(sessions)
                .build();
    }

    private ReplayHistoryDto emptyResult(String sym, LocalDate date, String tf) {
        return ReplayHistoryDto.builder()
                .symbol(sym)
                .replayDate(date.toString())
                .timeframe(tf)
                .totalBars(0)
                .simulatedSignals(0)
                .sessionCandles(List.of())
                .timeline(List.of())
                .scoreHistory(List.of())
                .lifecyclePath(List.of())
                .build();
    }

    private CandleChartDto toChartDto(Candle c) {
        return CandleChartDto.builder()
                .time(MarketTime.formatIso(c.getOpenTime()))
                .open(c.getOpen().doubleValue())
                .high(c.getHigh().doubleValue())
                .low(c.getLow().doubleValue())
                .close(c.getClose().doubleValue())
                .volume(c.getVolume() != null ? c.getVolume().doubleValue() : 0)
                .build();
    }
}
