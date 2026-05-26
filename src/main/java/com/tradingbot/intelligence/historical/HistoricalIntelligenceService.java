package com.tradingbot.intelligence.historical;

import com.tradingbot.api.dto.historical.HistoricalDtos.*;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.historical.CandleHistoryService;
import com.tradingbot.intelligence.MarketMemoryService;
import com.tradingbot.repository.SignalOutcomeRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class HistoricalIntelligenceService {

    private final SetupStatisticsService setupStatisticsService;
    private final MovementIntelligenceService movementIntelligenceService;
    private final SessionFingerprintService fingerprintService;
    private final SectorMemoryService sectorMemoryService;
    private final TimeOfDayIntelligenceService timeOfDayIntelligenceService;
    private final MarketMemoryService marketMemoryService;
    private final SignalOutcomeRepository outcomeRepository;
    private final CandleHistoryService candleHistoryService;
    private final TradingProperties tradingProperties;

    public HistoricalInsightDto insight(String setupType, String symbol) {
        int days = tradingProperties.getIntelligenceLookbackDays();
        SetupStatisticsDto stats = setupStatisticsService.statistics(setupType, days);
        MovementIntelligenceDto movement = movementIntelligenceService.analyze(setupType, symbol);

        List<String> notes = new ArrayList<>();
        notes.add(String.format(Locale.US, "%.0f%% win rate over last %d sessions",
                stats.getWinRate() * 100, days));
        if (stats.getBestRegime() != null) {
            notes.add("Best performance in " + stats.getBestRegime());
        }
        if (movement.getExpectedMovePercent() != null) {
            notes.add(String.format(Locale.US, "Average move after %s: %.1f%%",
                    stats.getSetupType(), movement.getExpectedMovePercent()));
        }
        if (movement.getTypicalFailureTime() != null) {
            notes.add("Typical failure begins after " + movement.getTypicalFailureTime());
        }

        return HistoricalInsightDto.builder()
                .setupType(stats.getSetupType())
                .symbol(symbol != null ? symbol.toUpperCase() : null)
                .lookbackDays(days)
                .winRate(stats.getWinRate())
                .avgMovePercent(movement.getExpectedMovePercent())
                .bestRegime(stats.getBestRegime())
                .worstRegime(stats.getWorstRegime())
                .bestTimeWindow(stats.getBestTimeWindow())
                .typicalFailureTime(movement.getTypicalFailureTime())
                .probabilisticNotes(notes)
                .statistics(stats)
                .movement(movement)
                .build();
    }

    public HistoricalSnapshotDto snapshot() {
        int days = tradingProperties.getIntelligenceLookbackDays();
        LocalDate since = MarketTime.nowLocal().toLocalDate().minusDays(days);
        var memory = marketMemoryService.expandedMemory(days);

        return HistoricalSnapshotDto.builder()
                .lookbackDays(days)
                .storedCandleDays(candleHistoryService.availableReplayDates("NVDA").size())
                .totalOutcomes(outcomeRepository.findSince(since).size())
                .setupStatistics(setupStatisticsService.allSetupStatistics(days))
                .sectorMemory(sectorMemoryService.sectorMemory())
                .timeOfDay(timeOfDayIntelligenceService.analyze())
                .todayFingerprint(fingerprintService.today())
                .expandedMemoryNarratives(memory.getNarratives())
                .regimeSetupWinRates(memory.getRegimeSetupWinRates())
                .build();
    }

    public ReplayDatesDto replayDates(String symbol) {
        return ReplayDatesDto.builder()
                .symbol(symbol.toUpperCase())
                .availableDates(candleHistoryService.availableReplayDates(symbol).stream()
                        .map(LocalDate::toString).toList())
                .lookbackDays(tradingProperties.getHistoricalLookbackDays())
                .build();
    }
}
