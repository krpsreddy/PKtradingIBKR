package com.tradingbot.historical.backtest;

import com.tradingbot.intelligence.historical.SetupStatisticsService;
import com.tradingbot.models.SignalOutcome;
import com.tradingbot.repository.SignalOutcomeRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BacktestDataAdapter implements BacktestDataPort {

    private final SignalOutcomeRepository outcomeRepository;
    private final SetupStatisticsService setupStatisticsService;

    @Override
    public List<SignalOutcome> outcomesBetween(LocalDate start, LocalDate end) {
        return outcomeRepository.findSince(start).stream()
                .filter(o -> !o.getSessionDate().isAfter(end))
                .toList();
    }

    @Override
    public double setupWinRate(String setupType, int lookbackDays) {
        return setupStatisticsService.statistics(setupType, lookbackDays).getWinRate();
    }
}
