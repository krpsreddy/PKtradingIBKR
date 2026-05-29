package com.tradingbot.replay;

import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Phase 193 — marks active replay API work so live runtime paths can defer heavy work.
 */
@Component
public class ReplayRuntimeMode {

    private final AtomicInteger activeDepth = new AtomicInteger(0);

    public boolean isReplayActive() {
        return activeDepth.get() > 0;
    }

    public Scope enter() {
        activeDepth.incrementAndGet();
        return new Scope(activeDepth);
    }

    public record Scope(AtomicInteger depth) implements AutoCloseable {
        @Override
        public void close() {
            depth.updateAndGet(v -> Math.max(0, v - 1));
        }
    }
}
