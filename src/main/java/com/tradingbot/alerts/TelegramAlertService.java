package com.tradingbot.alerts;

import com.tradingbot.config.TelegramProperties;
import com.tradingbot.intelligence.OptionsAwareAlertFormatter;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.services.MarketHoursService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelegramAlertService {

    private final TelegramProperties telegramProperties;
    private final RestTemplate restTemplate;
    private final MarketHoursService marketHoursService;
    private final OptionsAwareAlertFormatter optionsAwareAlertFormatter;

    public boolean sendMomBuyAlert(String symbol, BigDecimal price, IndicatorResult indicators) {
        String vwapTrend = price.compareTo(indicators.getVwap()) > 0 ? "Bullish" : "Bearish";
        String emaTrend = indicators.getEma9().compareTo(indicators.getEma20()) > 0
                ? "EMA9 > EMA20" : "EMA9 <= EMA20";

        String message = """
                🚀 MOM BUY
                Symbol: %s
                Timeframe: 5m
                Price: %s
                RSI: %s
                VWAP: %s
                EMA Trend: %s
                Time: %s
                %s
                """.formatted(
                symbol,
                price,
                indicators.getRsi().setScale(0, java.math.RoundingMode.HALF_UP),
                vwapTrend,
                emaTrend,
                marketHoursService.formatEstNow(),
                optionsAwareAlertFormatter.formatFooter(symbol, indicators, null)
        ).trim();

        return sendConfiguredMessage(message);
    }

    public boolean sendOpenMomBuyAlert(String symbol, BigDecimal price, IndicatorResult indicators, Double gapPercent) {
        String rvol = indicators.getRelativeVolume() != null
                ? indicators.getRelativeVolume().setScale(1, java.math.RoundingMode.HALF_UP) + "x"
                : "—";
        String gap = gapPercent != null
                ? String.format("%+.1f%%", gapPercent)
                : "—";

        String message = """
                🚀 OPEN MOM BUY

                %s @ %s

                Opening momentum breakout
                Gap: %s
                RVOL: %s
                Above VWAP
                Strong opening range breakout
                Time: %s
                %s
                """.formatted(
                symbol,
                price,
                gap,
                rvol,
                marketHoursService.formatEstNow(),
                optionsAwareAlertFormatter.formatFooter(symbol, indicators, null)
        ).trim();

        return sendConfiguredMessage(message);
    }

    public boolean sendOpenScoutAlert(String symbol, BigDecimal price, Double gapPercent,
                                      Double estimatedRvol, java.util.List<String> reasons) {
        String gap = gapPercent != null ? String.format("%+.1f%%", gapPercent) : "—";
        String rvol = estimatedRvol != null
                ? String.format("%.1fx", estimatedRvol)
                : "—";
        String reasonLine = reasons != null && !reasons.isEmpty()
                ? String.join("\n", reasons)
                : "Unusual opening momentum";

        String message = """
                ⚡ OPEN SCOUT

                %s @ %s

                Early opening momentum detected
                Gap: %s
                Live RVOL: %s
                %s

                Waiting for confirmation...
                Time: %s
                """.formatted(
                symbol,
                price,
                gap,
                rvol,
                reasonLine,
                marketHoursService.formatEstNow()
        ).trim();

        return sendConfiguredMessage(message);
    }

    public boolean sendOpenFailAlert(String symbol, java.math.BigDecimal price,
                                     java.util.List<String> reasons, String putLabel) {
        String reasonLine = reasons != null && !reasons.isEmpty()
                ? String.join("\n", reasons)
                : "Opening breakout failure";
        String putLine = putLabel != null && !putLabel.isBlank()
                ? "\nPotential " + putLabel
                : "\nPotential PUT setup";

        String message = """
                🔻 OPEN FAIL

                %s @ %s

                Opening breakout failure
                Lost VWAP
                Heavy rejection
                Bearish momentum shift
                %s
                %s
                Time: %s
                """.formatted(
                symbol,
                price,
                reasonLine,
                putLine.trim(),
                marketHoursService.formatEstNow()
        ).trim();

        return sendConfiguredMessage(message);
    }

    public boolean sendOpenFailBreakAlert(String symbol, java.math.BigDecimal price,
                                          java.util.List<String> reasons, String label) {
        String reasonLine = reasons != null && !reasons.isEmpty()
                ? String.join("\n", reasons)
                : "Early opening breakdown";

        String message = """
                ⬇ OPEN FAIL BREAK

                %s @ %s

                Early breakdown entry
                %s
                %s
                Time: %s
                """.formatted(
                symbol,
                price,
                reasonLine,
                label != null && !label.isBlank() ? label : "BREAKDOWN",
                marketHoursService.formatEstNow()
        ).trim();

        return sendConfiguredMessage(message);
    }

    public boolean sendRecoveryFailAlert(String symbol, java.math.BigDecimal price,
                                         java.util.List<String> reasons, String putLabel) {
        String reasonLine = reasons != null && !reasons.isEmpty()
                ? String.join("\n", reasons)
                : "Failed dead-cat rally";
        String putLine = putLabel != null && !putLabel.isBlank()
                ? "\nPotential " + putLabel
                : "\nPotential PUT setup";

        String message = """
                📉 RECOVERY FAIL

                %s @ %s

                Dead-cat rally failed
                Lower high / lost VWAP
                %s
                %s
                Time: %s
                """.formatted(
                symbol,
                price,
                reasonLine,
                putLine.trim(),
                marketHoursService.formatEstNow()
        ).trim();

        return sendConfiguredMessage(message);
    }

    public boolean sendImbalanceDownAlert(String symbol, java.math.BigDecimal price,
                                          java.util.List<String> reasons, String putLabel) {
        String reasonLine = reasons != null && !reasons.isEmpty()
                ? String.join("\n", reasons)
                : "Break below big candle low";
        String putLine = putLabel != null && !putLabel.isBlank()
                ? "\nPotential " + putLabel + " (PUT)"
                : "\nPotential PUT setup";

        String message = """
                ⬇ IMBALANCE DOWN

                %s @ %s

                Bearish FVG — sellers left a gap (high c3 below low c1)
                %s
                %s
                Time: %s
                """.formatted(
                symbol,
                price,
                reasonLine,
                putLine.trim(),
                marketHoursService.formatEstNow()
        ).trim();

        return sendConfiguredMessage(message);
    }

    public boolean sendImbalanceUpAlert(String symbol, java.math.BigDecimal price,
                                         java.util.List<String> reasons, String callLabel) {
        String reasonLine = reasons != null && !reasons.isEmpty()
                ? String.join("\n", reasons)
                : "Break above big candle high";
        String callLine = callLabel != null && !callLabel.isBlank()
                ? "\nPotential " + callLabel + " (CALL)"
                : "\nPotential CALL setup";

        String message = """
                ⬆ IMBALANCE UP

                %s @ %s

                Bullish FVG — buyers left a gap (low c3 above high c1)
                %s
                %s
                Time: %s
                """.formatted(
                symbol,
                price,
                reasonLine,
                callLine.trim(),
                marketHoursService.formatEstNow()
        ).trim();

        return sendConfiguredMessage(message);
    }

    public boolean sendContBuyAlert(String symbol, BigDecimal price, IndicatorResult indicators) {
        String vwapTrend = price.compareTo(indicators.getVwap()) > 0 ? "Bullish" : "Bearish";
        String rvol = indicators.getRelativeVolume() != null
                ? indicators.getRelativeVolume().setScale(1, java.math.RoundingMode.HALF_UP) + "x"
                : "—";

        String message = """
                🚀 CONT BUY
                %s @ %s

                Bullish continuation breakout
                RVOL: %s
                RSI: %s
                Trend: %s
                Above VWAP
                Time: %s
                %s
                """.formatted(
                symbol,
                price,
                rvol,
                indicators.getRsi().setScale(0, java.math.RoundingMode.HALF_UP),
                vwapTrend,
                marketHoursService.formatEstNow(),
                optionsAwareAlertFormatter.formatFooter(symbol, indicators, null)
        ).trim();

        return sendConfiguredMessage(message);
    }

    public boolean sendPullBuyAlert(String symbol, BigDecimal price, IndicatorResult indicators) {
        String vwapTrend = price.compareTo(indicators.getVwap()) > 0 ? "Bullish" : "Bearish";
        String emaTouch = describeEmaTouch(indicators);

        String message = """
                📈 PULL BUY
                Symbol: %s
                %s
                RSI: %s
                VWAP: %s
                Time: %s
                """.formatted(
                symbol,
                emaTouch,
                indicators.getRsi().setScale(0, java.math.RoundingMode.HALF_UP),
                vwapTrend,
                marketHoursService.formatEstNow()
        ).trim();

        return sendConfiguredMessage(message);
    }

    private String describeEmaTouch(IndicatorResult i) {
        if (i.getLow().compareTo(i.getEma20()) <= 0) {
            return "Price bounced near EMA20";
        }
        if (i.getLow().compareTo(i.getEma9()) <= 0) {
            return "Price bounced near EMA9";
        }
        return "Price bounced near EMA";
    }

    public boolean sendTestAlert(String suffix) {
        String message = """
                🚀 MOM BUY (TEST)
                Symbol: NVDA
                Timeframe: 5m
                Price: 178.22
                RSI: 61
                VWAP: Bullish
                EMA Trend: EMA9 > EMA20
                %s
                """.formatted(suffix).trim();
        return sendConfiguredMessage(message);
    }

    /** Phase 185 — operational screener/trader alerts (deduped by caller). */
    public boolean sendOperationalAlert(String message) {
        return sendConfiguredMessage(message);
    }

    private boolean sendConfiguredMessage(String message) {
        String token = telegramProperties.getBotToken();
        String chatId = telegramProperties.getChatId();
        if (token == null || token.isBlank() || chatId == null || chatId.isBlank()) {
            log.warn("Telegram not configured — alert skipped");
            return false;
        }
        return sendMessage(chatId, message, token);
    }

    private boolean sendMessage(String chatId, String message, String token) {
        String url = "https://api.telegram.org/bot" + token + "/sendMessage";

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("chat_id", chatId);
        body.put("text", message);
        body.put("disable_notification", false);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null
                    && response.getBody().contains("\"ok\":true")) {
                log.info("Telegram alert delivered to chat {}", chatId);
                return true;
            }
            log.warn("Telegram API failed: status={} body={}", response.getStatusCode(), response.getBody());
            return false;
        } catch (Exception e) {
            log.error("Failed to send Telegram alert", e);
            return false;
        }
    }
}
