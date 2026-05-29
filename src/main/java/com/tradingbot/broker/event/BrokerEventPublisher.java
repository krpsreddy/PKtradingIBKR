package com.tradingbot.broker.event;

import com.tradingbot.broker.model.BrokerConnectionStatusDto;
import com.tradingbot.broker.model.BrokerEventPayload;
import com.tradingbot.broker.model.BrokerEventType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

@Component
@RequiredArgsConstructor
public class BrokerEventPublisher {

    private final ApplicationEventPublisher applicationEventPublisher;
    private final List<Consumer<BrokerEventPayload>> sseListeners = new CopyOnWriteArrayList<>();

    public void publish(BrokerEventType event, BrokerConnectionStatusDto status) {
        BrokerEventPayload payload = new BrokerEventPayload(event, status, System.currentTimeMillis());
        applicationEventPublisher.publishEvent(payload);
        for (Consumer<BrokerEventPayload> listener : sseListeners) {
            try {
                listener.accept(payload);
            } catch (Exception ignored) {
                /* listener fault isolation */
            }
        }
    }

    public void addListener(Consumer<BrokerEventPayload> listener) {
        sseListeners.add(listener);
    }
}
