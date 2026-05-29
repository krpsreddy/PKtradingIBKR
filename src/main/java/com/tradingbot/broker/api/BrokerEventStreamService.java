package com.tradingbot.broker.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.broker.connection.BrokerConnectionManager;
import com.tradingbot.broker.event.BrokerEventPublisher;
import com.tradingbot.broker.model.BrokerEventPayload;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/** SSE stream for broker lifecycle events (scanner / UI continuity). */
@Service
public class BrokerEventStreamService {

    private final BrokerConnectionManager connectionManager;
    private final ObjectMapper objectMapper;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public BrokerEventStreamService(
            BrokerConnectionManager connectionManager,
            BrokerEventPublisher eventPublisher,
            ObjectMapper objectMapper
    ) {
        this.connectionManager = connectionManager;
        this.objectMapper = objectMapper;
        eventPublisher.addListener(this::broadcast);
    }

    public SseEmitter stream() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        send(emitter, initialPayload());
        return emitter;
    }

    private BrokerEventPayload initialPayload() {
        return new BrokerEventPayload(
                com.tradingbot.broker.model.BrokerEventType.BROKER_CONNECTED,
                connectionManager.status(),
                System.currentTimeMillis()
        );
    }

    private void broadcast(BrokerEventPayload payload) {
        for (SseEmitter emitter : emitters) {
            send(emitter, payload);
        }
    }

    private void send(SseEmitter emitter, BrokerEventPayload payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            emitter.send(SseEmitter.event().name("broker").data(json, MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            emitters.remove(emitter);
            try {
                emitter.completeWithError(e);
            } catch (Exception ignored) {
                /* already closed */
            }
        }
    }
}
