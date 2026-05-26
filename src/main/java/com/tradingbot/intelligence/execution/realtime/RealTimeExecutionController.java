package com.tradingbot.intelligence.execution.realtime;

import com.tradingbot.intelligence.execution.realtime.dto.RealTimeExecutionDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Phase 167 — real-time execution feed API (SSE + pull). */
@RestController
@RequestMapping("/api/execution")
@RequiredArgsConstructor
public class RealTimeExecutionController {

    private final RealTimeExecutionEngine executionEngine;
    private final ExecutionFeedStreamService feedStreamService;

    @GetMapping("/feed")
    public ExecutionFeedSnapshotDto feed() {
        return executionEngine.snapshot();
    }

    @GetMapping(value = "/feed/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter feedStream() {
        return feedStreamService.stream();
    }

    @GetMapping("/feed/{symbol}")
    public ExecutionFeedItemDto feedSymbol(@PathVariable String symbol) {
        return executionEngine.itemForSymbol(symbol)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "No live execution state for symbol"));
    }
}
