package com.tradingbot.api;

import com.tradingbot.api.dto.*;
import com.tradingbot.intelligence.*;
import com.tradingbot.models.TradeJournalEntry;
import com.tradingbot.repository.TradeJournalEntryRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final TraderPerformanceAnalyticsService performanceAnalytics;
    private final BehaviorAnalyticsService behaviorAnalytics;
    private final MarketMemoryService marketMemoryService;
    private final TradingPlaybookService playbookService;
    private final ReplayCoachingService replayCoachingService;
    private final AdaptiveRankingService adaptiveRankingService;
    private final OutcomeTrackingService outcomeTrackingService;
    private final TradeJournalEntryRepository journalRepository;

    @GetMapping("/edge")
    public TraderEdgeDto edge(@RequestParam(defaultValue = "30") int days) {
        return performanceAnalytics.computeEdge(days);
    }

    @GetMapping("/behavior")
    public List<BehaviorInsightDto> behavior() {
        return behaviorAnalytics.todayInsights();
    }

    @GetMapping("/memory")
    public MarketMemoryDto memory() {
        return marketMemoryService.todayMemory();
    }

    @GetMapping("/playbooks")
    public List<PlaybookDto> playbooks() {
        return playbookService.playbooks();
    }

    @GetMapping("/coaching/{symbol}")
    public ReplayCoachingDto coaching(@PathVariable String symbol) {
        return replayCoachingService.coach(symbol.toUpperCase());
    }

    @GetMapping("/confidence")
    public List<StatisticalConfidenceDto> confidence(
            @RequestParam(required = false) String signalType,
            @RequestParam(required = false) String regime) {
        List<StatisticalConfidenceDto> out = new ArrayList<>();
        if (signalType != null && regime != null) {
            double wr = adaptiveRankingService.winRate(signalType, regime);
            if (wr >= 0) {
                out.add(StatisticalConfidenceDto.builder()
                        .signalType(signalType)
                        .regime(regime)
                        .winRatePercent(wr)
                        .label(Math.round(wr) + "% historical win rate")
                        .build());
            }
        }
        return out;
    }

    @GetMapping("/session-review")
    public SessionReviewDto sessionReview() {
        var memory = marketMemoryService.todayMemory();
        var edge = performanceAnalytics.computeEdge(1);
        var behavior = behaviorAnalytics.todayInsights();
        return SessionReviewDto.builder()
                .sessionDate(MarketTime.nowLocal().toLocalDate().toString())
                .topSetups(memory.getStrongestSetups())
                .failedSetups(memory.getFailingSetups())
                .strongestSectors(List.of())
                .missedOpportunities(List.of())
                .regimeShifts(List.of())
                .summary(edge.getSummary() + (behavior.isEmpty() ? "" : " " + behavior.get(0).getTitle()))
                .build();
    }

    @PostMapping("/outcomes/sync-journal")
    public void syncJournalOutcomes() {
        for (TradeJournalEntry j : journalRepository.findAll()) {
            if (j.getResult() != null && !j.getResult().isBlank()) {
                outcomeTrackingService.fromJournal(j);
            }
        }
    }
}
