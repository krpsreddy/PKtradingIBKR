package com.tradingbot.api;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.ProbabilisticExecutionSnapshotDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.ReplayProbabilisticDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.MarketHeartbeatDto;
import com.tradingbot.intelligence.probabilistic.ProbabilisticExecutionOrchestrator;
import com.tradingbot.intelligence.situational.MarketHeartbeatService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/probabilistic")
@RequiredArgsConstructor
public class ProbabilisticExecutionController {

    private final ProbabilisticExecutionOrchestrator orchestrator;
    private final MarketHeartbeatService heartbeatService;

    @GetMapping("/snapshot")
    public ProbabilisticExecutionSnapshotDto snapshot(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String signalType) {
        return orchestrator.snapshot(symbol, signalType);
    }

    @GetMapping("/replay/{symbol}")
    public ReplayProbabilisticDto replay(
            @PathVariable String symbol,
            @RequestParam(required = false) String signalType,
            @RequestParam(defaultValue = "0") int index) {
        return orchestrator.replay(symbol, signalType, index);
    }

    @GetMapping("/heartbeat")
    public MarketHeartbeatDto heartbeat() {
        return heartbeatService.heartbeat();
    }
}
