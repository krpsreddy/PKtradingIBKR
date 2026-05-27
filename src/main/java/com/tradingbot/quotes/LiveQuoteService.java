package com.tradingbot.quotes;

import com.tradingbot.historical.CandleHistoryService;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.ibkr.SubscriptionManagerService;
import com.tradingbot.models.Candle;
import com.tradingbot.quotes.LiveQuoteDtos.QuoteDto;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Lightweight batched last-price quotes for visible symbols only. */
@Slf4j
@Service
@RequiredArgsConstructor
public class LiveQuoteService {

    private static final long STALE_MS = 8_000;

    private final IBKRClientService ibkrClientService;
    private final SubscriptionManagerService subscriptionManager;
    private final CandleHistoryService candleHistoryService;

    private final ConcurrentHashMap<String, Double> referenceCloseCache = new ConcurrentHashMap<>();

    public Map<String, QuoteDto> getQuotes(List<String> symbols) {
        Map<String, QuoteDto> out = new LinkedHashMap<>();
        boolean streaming = ibkrClientService.isConnectedAndStreaming();
        long now = System.currentTimeMillis();

        for (String raw : symbols) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String sym = raw.trim().toUpperCase();
            subscriptionManager.subscribeIfNeeded(sym);

            Double price = ibkrClientService.getLastPrice(sym);
            if (price == null) {
                price = lastCandleClose(sym);
            }
            if (price == null) {
                continue;
            }

            Double ref = resolveReferenceClose(sym);
            Double change = null;
            Double changePct = null;
            if (ref != null && ref > 0) {
                change = price - ref;
                changePct = (change / ref) * 100.0;
            }

            Long tickMs = ibkrClientService.getLastTickEpochMs(sym);
            boolean stale = !streaming || tickMs == null || (now - tickMs) > STALE_MS;
            long ts = tickMs != null ? tickMs / 1000L : now / 1000L;

            out.put(sym, new QuoteDto(
                    round(price),
                    change != null ? round(change) : null,
                    changePct != null ? round(changePct) : null,
                    ibkrClientService.getLastVolume(sym),
                    ts,
                    stale
            ));
        }
        return out;
    }

    private Double resolveReferenceClose(String sym) {
        Double cached = referenceCloseCache.get(sym);
        if (cached != null) {
            return cached;
        }
        Double ibkrRef = ibkrClientService.getReferenceClose(sym);
        if (ibkrRef != null && ibkrRef > 0) {
            referenceCloseCache.put(sym, ibkrRef);
            return ibkrRef;
        }
        Double hist = priorSessionClose(sym);
        if (hist != null && hist > 0) {
            referenceCloseCache.put(sym, hist);
        }
        return hist;
    }

    private Double priorSessionClose(String sym) {
        LocalDate today = MarketTime.nowLocal().toLocalDate();
        List<Candle> candles = candleHistoryService.loadSessionCandles(sym);
        return candles.stream()
                .filter(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().isBefore(today))
                .max(Comparator.comparing(Candle::getOpenTime))
                .map(c -> c.getClose().doubleValue())
                .orElseGet(() -> candles.stream()
                        .min(Comparator.comparing(Candle::getOpenTime))
                        .map(c -> c.getOpen().doubleValue())
                        .orElse(null));
    }

    private Double lastCandleClose(String sym) {
        return candleHistoryService.loadSessionCandles(sym).stream()
                .max(Comparator.comparing(Candle::getOpenTime))
                .map(c -> c.getClose().doubleValue())
                .orElse(null);
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
