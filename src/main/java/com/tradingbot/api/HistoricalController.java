package com.tradingbot.api;

import com.tradingbot.api.dto.historical.HistoricalDtos.*;
import com.tradingbot.intelligence.historical.HistoricalIntelligenceService;
import com.tradingbot.intelligence.historical.SetupStatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/historical")
@RequiredArgsConstructor
public class HistoricalController {

    private final HistoricalIntelligenceService historicalIntelligenceService;
    private final SetupStatisticsService setupStatisticsService;

    @GetMapping("/snapshot")
    public HistoricalSnapshotDto snapshot() {
        return historicalIntelligenceService.snapshot();
    }

    @GetMapping("/insight")
    public HistoricalInsightDto insight(
            @RequestParam String setupType,
            @RequestParam(required = false) String symbol) {
        return historicalIntelligenceService.insight(setupType, symbol);
    }

    @GetMapping("/setup/{setupType}")
    public SetupStatisticsDto setupStats(@PathVariable String setupType,
                                         @RequestParam(defaultValue = "60") int days) {
        return setupStatisticsService.statistics(setupType, days);
    }

    @GetMapping("/replay-dates/{symbol}")
    public ReplayDatesDto replayDates(@PathVariable String symbol) {
        return historicalIntelligenceService.replayDates(symbol);
    }
}
