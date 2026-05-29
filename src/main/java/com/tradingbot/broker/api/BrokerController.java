package com.tradingbot.broker.api;

import com.tradingbot.broker.connection.BrokerConnectionManager;
import com.tradingbot.broker.connection.BrokerProfileCatalog;
import com.tradingbot.broker.model.BrokerConnectionStatusDto;
import com.tradingbot.broker.model.BrokerProfile;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/broker")
@RequiredArgsConstructor
public class BrokerController {

    private final BrokerProfileCatalog catalog;
    private final BrokerConnectionManager connectionManager;
    private final BrokerEventStreamService eventStreamService;

    @GetMapping("/profiles")
    public List<BrokerProfile> profiles() {
        return catalog.all();
    }

    @GetMapping("/status")
    public BrokerConnectionStatusDto status() {
        return connectionManager.status();
    }

    @PostMapping("/connect/{profileId}")
    public ResponseEntity<Map<String, Object>> connect(@PathVariable String profileId) {
        CompletableFuture<Void> future = connectionManager.connect(profileId);
        try {
            future.get();
            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "profileId", profileId,
                    "status", connectionManager.status()
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "ok", false,
                    "profileId", profileId,
                    "error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName(),
                    "status", connectionManager.status()
            ));
        }
    }

    @PostMapping("/disconnect")
    public BrokerConnectionStatusDto disconnect() {
        connectionManager.disconnect();
        return connectionManager.status();
    }

    @GetMapping(value = "/events/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter eventStream() {
        return eventStreamService.stream();
    }

    @PostMapping("/reconnect")
    public ResponseEntity<Map<String, Object>> reconnect() {
        try {
            connectionManager.reconnect().get();
            return ResponseEntity.ok(Map.of("ok", true, "status", connectionManager.status()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "ok", false,
                    "error", e.getMessage() != null ? e.getMessage() : "reconnect failed",
                    "status", connectionManager.status()
            ));
        }
    }
}
