package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.TradeExpectancyDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.intelligence.historical.SetupStatisticsService;
import com.tradingbot.models.SignalOutcome;
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
public class TradeExpectancyService {

    private final SetupStatisticsService setupStatisticsService;
    private final SignalOutcomeRepository outcomeRepository;
    private final TradingProperties tradingProperties;

    public TradeExpectancyDto expectancy(String setupType, Double estimatedRr) {
        String setup = SetupStatisticsService.normalize(setupType);
        var stats = setupStatisticsService.statistics(setup, tradingProperties.getIntelligenceLookbackDays());

        LocalDate since = MarketTime.nowLocal().toLocalDate().minusDays(tradingProperties.getIntelligenceLookbackDays());
        List<SignalOutcome> outcomes = outcomeRepository.findBySetupTypeAndSessionDateGreaterThanEqual(setup, since);

        double winRate = stats.getWinRate();
        double avgWin = avgR(outcomes, true);
        double avgLoss = avgR(outcomes, false);
        double expR = (winRate * avgWin) - ((1 - winRate) * avgLoss);
        if (outcomes.isEmpty()) {
            expR = winRate > 0 ? (winRate * 1.5) - ((1 - winRate) * 1.0) : 0.5;
        }

        Double rr = estimatedRr != null ? estimatedRr : (avgWin > 0 ? avgWin / Math.max(0.5, avgLoss) : 2.0);

        List<String> notes = new ArrayList<>();
        notes.add(String.format(Locale.US, "Win rate (60d): %.0f%%", winRate * 100));
        if (stats.getSampleSize() > 0) {
            notes.add(String.format(Locale.US, "Sample: %d outcomes", stats.getSampleSize()));
        }

        String quality = expR >= 0.5 ? "STRONG" : expR >= 0 ? "POSITIVE" : "NEGATIVE";

        return TradeExpectancyDto.builder()
                .expectedRr(Math.round(rr * 10) / 10.0)
                .historicalExpectancyR(Math.round(expR * 100) / 100.0)
                .winRate(Math.round(winRate * 1000) / 10.0)
                .qualityLabel(quality)
                .notes(notes)
                .build();
    }

    private double avgR(List<SignalOutcome> outcomes, boolean wins) {
        return outcomes.stream()
                .filter(o -> wins ? "WIN".equals(o.getOutcome()) : "LOSS".equals(o.getOutcome()))
                .map(SignalOutcome::getMaxFavorableExcursion)
                .filter(java.util.Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(wins ? 1.5 : 1.0);
    }
}
