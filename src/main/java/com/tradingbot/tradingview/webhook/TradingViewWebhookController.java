package com.tradingbot.tradingview.webhook;

import com.tradingbot.tradingview.dto.TradingViewWebhookPayload;
import com.tradingbot.tradingview.dto.TradingViewWebhookResultDto;
import com.tradingbot.tradingview.ingestion.TradingViewWebhookIngestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Phase 217 — TradingView Pine alert webhook ingress. */
@RestController
@RequestMapping("/api/tradingview")
@RequiredArgsConstructor
public class TradingViewWebhookController {

    private final TradingViewWebhookIngestionService ingestionService;

    @PostMapping("/webhook")
    public ResponseEntity<TradingViewWebhookResultDto> webhook(
            @RequestBody TradingViewWebhookPayload payload,
            @RequestHeader(value = "X-TV-Token", required = false) String token
    ) {
        if (!ingestionService.validateToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new TradingViewWebhookResultDto(false, null, "invalid token"));
        }
        TradingViewWebhookResultDto result = ingestionService.ingest(payload);
        return result.accepted()
                ? ResponseEntity.accepted().body(result)
                : ResponseEntity.ok(result);
    }
}
