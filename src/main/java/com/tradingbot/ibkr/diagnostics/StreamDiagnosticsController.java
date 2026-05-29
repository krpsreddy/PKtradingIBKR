package com.tradingbot.ibkr.diagnostics;

import com.tradingbot.dataintegrity.DataIntegrityEngine;
import com.tradingbot.dataintegrity.DataIntegritySnapshot;
import com.tradingbot.runtime.RuntimeProfileDto;
import com.tradingbot.runtime.RuntimeProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Phase 219 — stream pipeline diagnostic endpoints (read-only). */
@RestController
@RequestMapping("/api/live-trader")
@RequiredArgsConstructor
public class StreamDiagnosticsController {

    private final StreamDiagnosticsService diagnosticsService;
    private final RuntimeProfileService runtimeProfileService;
    private final DataIntegrityEngine dataIntegrityEngine;

    @GetMapping("/stream-debug")
    public StreamPipelineDiagnostics.StreamHealthSnapshot streamDebug() {
        return diagnosticsService.streamDebug();
    }

    @GetMapping("/tick-health")
    public StreamDiagnosticsService.TickHealthDto tickHealth() {
        return diagnosticsService.tickHealth();
    }

    @GetMapping("/candle-health")
    public StreamDiagnosticsService.CandleHealthDto candleHealth() {
        return diagnosticsService.candleHealth();
    }

    @GetMapping("/reconnect-history")
    public StreamDiagnosticsService.ReconnectHistoryDto reconnectHistory() {
        return diagnosticsService.reconnectHistory();
    }

    @GetMapping("/execution-integrity")
    public ExecutionIntegrityDto executionIntegrity() {
        RuntimeProfileDto runtime = runtimeProfileService.snapshot();
        DataIntegritySnapshot integrity = dataIntegrityEngine.current();
        return new ExecutionIntegrityDto(
                runtime.runtime(),
                runtime.executionMode(),
                runtime.integrityMode(),
                runtime.port(),
                runtime.ibkrPort(),
                integrity.state().name(),
                integrity.score(),
                integrity.allowsExecution()
        );
    }

    public record ExecutionIntegrityDto(
            String runtime,
            String executionMode,
            String integrityMode,
            int port,
            int ibkrPort,
            String dataIntegrityState,
            int dataIntegrityScore,
            boolean executionAllowed
    ) {}
}
