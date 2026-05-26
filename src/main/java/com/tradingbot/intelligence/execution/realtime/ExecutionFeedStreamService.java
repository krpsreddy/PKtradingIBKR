package com.tradingbot.intelligence.execution.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.intelligence.execution.realtime.dto.RealTimeExecutionDtos.ExecutionFeedSnapshotDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/** SSE push for execution feed — replaces aggressive client polling when connected. */
@Service
@RequiredArgsConstructor
public class ExecutionFeedStreamService {

    private static final long PUSH_INTERVAL_MS = 1_500;

    private final RealTimeExecutionEngine executionEngine;
    private final ObjectMapper objectMapper;
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    public SseEmitter stream() {
        SseEmitter emitter = new SseEmitter(0L);
        ScheduledFuture<?> task = scheduler.scheduleAtFixedRate(() -> push(emitter), 0, PUSH_INTERVAL_MS, TimeUnit.MILLISECONDS);
        emitter.onCompletion(() -> task.cancel(false));
        emitter.onTimeout(() -> task.cancel(false));
        emitter.onError(e -> task.cancel(false));
        return emitter;
    }

    private void push(SseEmitter emitter) {
        try {
            ExecutionFeedSnapshotDto snap = executionEngine.snapshot();
            String json = objectMapper.writeValueAsString(snap);
            emitter.send(SseEmitter.event().data(json));
        } catch (IOException e) {
            emitter.completeWithError(e);
        } catch (Exception e) {
            try {
                emitter.completeWithError(e);
            } catch (Exception ignored) {
                /* emitter already closed */
            }
        }
    }
}
