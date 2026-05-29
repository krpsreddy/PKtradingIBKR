package com.tradingbot.tradingview.ingestion;

import com.tradingbot.tradingview.TradingViewProperties;
import com.tradingbot.tradingview.dto.TradingViewSignalDto;
import com.tradingbot.tradingview.dto.TradingViewWebhookPayload;
import com.tradingbot.tradingview.dto.TradingViewWebhookResultDto;
import com.tradingbot.tradingview.state.TradingViewSignalStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;

/** Phase 217 — validate and ingest Pine webhook alerts (intelligence only). */
@Slf4j
@Service
@RequiredArgsConstructor
@EnableConfigurationProperties(TradingViewProperties.class)
public class TradingViewWebhookIngestionService {

    private final TradingViewProperties properties;
    private final TradingViewAlertThrottler throttler;
    private final TradingViewSignalStore store;

    public TradingViewWebhookResultDto ingest(TradingViewWebhookPayload payload) {
        if (payload == null || payload.symbol() == null || payload.symbol().isBlank()) {
            return new TradingViewWebhookResultDto(false, null, "missing symbol");
        }
        if (!throttler.shouldAccept(payload)) {
            return new TradingViewWebhookResultDto(false, payload.symbol().toUpperCase(), "throttled");
        }
        TradingViewSignalDto stored = store.upsert(payload);
        log.info("TV webhook ingested {} {} dom={} lifecycle={}",
                stored.symbol(), stored.direction(), stored.dominance(), stored.lifecycle());
        return new TradingViewWebhookResultDto(true, stored.symbol(), "accepted");
    }

    public boolean validateToken(String token) {
        String secret = properties.getWebhookSecret();
        if (secret == null || secret.isBlank()) {
            return true;
        }
        return secret.equals(token);
    }
}
