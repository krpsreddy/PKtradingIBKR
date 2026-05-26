package com.tradingbot.alerts;

import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.repository.TradingSignalRepository;
import com.tradingbot.signals.SignalEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/test")
@RequiredArgsConstructor
public class TestAlertController {

    private final TelegramAlertService telegramAlertService;
    private final TradingSignalRepository tradingSignalRepository;

    @PostMapping("/mom-buy-alert")
    public ResponseEntity<Map<String, Object>> sendTestMomBuyAlert() {
        String symbol = "NVDA";
        BigDecimal price = new BigDecimal("178.22");
        BigDecimal rsi = new BigDecimal("61");
        String runId = String.valueOf(System.currentTimeMillis());

        IndicatorResult indicators = IndicatorResult.builder()
                .ema9(new BigDecimal("178.12"))
                .ema20(new BigDecimal("177.85"))
                .ema50(new BigDecimal("176.44"))
                .rsi(rsi)
                .macd(new BigDecimal("0.82"))
                .signalLine(new BigDecimal("0.74"))
                .vwap(new BigDecimal("177.95"))
                .avgVolume(100_000L)
                .volume(120_000L)
                .open(new BigDecimal("178.10"))
                .high(new BigDecimal("178.40"))
                .low(new BigDecimal("177.90"))
                .close(price)
                .valid(true)
                .build();

        boolean sent = telegramAlertService.sendTestAlert("Run: " + runId);

        tradingSignalRepository.save(TradingSignal.builder()
                .symbol(symbol)
                .signalType(SignalEngineService.MOM_BUY)
                .price(price)
                .rsi(rsi)
                .macd(indicators.getMacd())
                .timestamp(LocalDateTime.now())
                .build());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("telegramSent", sent);
        body.put("runId", runId);
        body.put("symbol", symbol);
        if (!sent) {
            body.put("hint", "Check telegram.bot-token and telegram.chat-id in application-local.properties, then restart app");
            return ResponseEntity.internalServerError().body(body);
        }
        body.put("message", "Check Telegram — you should see a new TEST message");
        return ResponseEntity.ok(body);
    }
}
