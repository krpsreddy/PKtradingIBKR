package com.tradingbot.historical;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.models.Candle;
import com.tradingbot.repository.CandleRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

/** Central access for multi-day candle history with retention policy. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CandleHistoryService {

    private final CandleRepository candleRepository;
    private final TradingProperties tradingProperties;

    public List<Candle> loadSessionCandles(String symbol) {
        String sym = symbol.toUpperCase();
        String tf = tradingProperties.getTimeframe();
        LocalDateTime since = lookbackStart();
        return candleRepository
                .findBySymbolAndTimeframeAndOpenTimeGreaterThanEqualOrderByOpenTimeAsc(sym, tf, since);
    }

    /** Phase 205 — today's session bars (most recent N). */
    public List<Candle> recentSessionCandles(String symbol, int maxBars) {
        LocalDate today = MarketTime.nowLocal().toLocalDate();
        List<Candle> todayBars = loadSessionCandles(symbol).stream()
                .filter(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(today))
                .toList();
        if (todayBars.size() <= maxBars) {
            return todayBars;
        }
        return todayBars.subList(todayBars.size() - maxBars, todayBars.size());
    }

    public List<Candle> loadSessionCandlesUntil(String symbol, LocalDate date) {
        return loadSessionCandles(symbol).stream()
                .filter(c -> !MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().isAfter(date))
                .toList();
    }

    public List<LocalDate> availableReplayDates(String symbol) {
        return loadSessionCandles(symbol).stream()
                .map(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate())
                .distinct()
                .sorted(Comparator.reverseOrder())
                .toList();
    }

    public LocalDateTime lookbackStart() {
        return MarketTime.nowLocal()
                .minusDays(tradingProperties.getHistoricalLookbackDays());
    }

    public int maxPersistBars() {
        return tradingProperties.getCandleHistorySize();
    }

    @Transactional
    public void purgeExpiredForSymbol(String symbol) {
        String sym = symbol.toUpperCase();
        String tf = tradingProperties.getTimeframe();
        LocalDateTime cutoff = MarketTime.nowLocal()
                .minusDays(tradingProperties.getCandleRetentionDays());
        int deleted = candleRepository.deleteOlderThan(sym, tf, cutoff);
        if (deleted > 0) {
            log.info("Purged {} expired candles for {}", deleted, sym);
        }
    }

    public long storedBarCount(String symbol) {
        return candleRepository.countBySymbolAndTimeframe(
                symbol.toUpperCase(), tradingProperties.getTimeframe());
    }

    /** Coverage summary for incremental hydration — stored candles only. */
    public com.tradingbot.api.dto.SymbolHistoryCoverageDto coverage(String symbol, int lookbackDays) {
        String sym = symbol.toUpperCase();
        String tf = tradingProperties.getTimeframe();
        int window = lookbackDays > 0 ? lookbackDays : tradingProperties.getHistoricalLookbackDays();
        LocalDate cutoff = MarketTime.nowLocal().toLocalDate().minusDays(window);

        List<Candle> candles = candleRepository
                .findBySymbolAndTimeframeAndOpenTimeGreaterThanEqualOrderByOpenTimeAsc(
                        sym, tf, cutoff.atStartOfDay());

        List<String> sessionDates = candles.stream()
                .map(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate())
                .distinct()
                .sorted(Comparator.naturalOrder())
                .map(LocalDate::toString)
                .toList();

        String earliest = candles.isEmpty() ? null
                : MarketTime.formatIso(candles.get(0).getOpenTime());
        String latest = candles.isEmpty() ? null
                : MarketTime.formatIso(candles.get(candles.size() - 1).getOpenTime());

        int loadedDays = sessionDates.size();
        boolean fullyLoaded = loadedDays >= window * 0.65; // ~39 trading days ≈ 60 calendar days

        String message = candles.isEmpty()
                ? "No stored candles — IBKR fetch required"
                : loadedDays + " session days stored (" + candles.size() + " bars)";

        return com.tradingbot.api.dto.SymbolHistoryCoverageDto.builder()
                .symbol(sym)
                .lookbackDays(window)
                .loadedSessionDays(loadedDays)
                .totalCandles(candles.size())
                .earliestTimestamp(earliest)
                .latestTimestamp(latest)
                .sessionDates(sessionDates)
                .fullyLoaded(fullyLoaded)
                .message(message)
                .build();
    }
}
