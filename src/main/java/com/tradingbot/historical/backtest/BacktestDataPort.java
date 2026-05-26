package com.tradingbot.historical.backtest;

import com.tradingbot.models.SignalOutcome;

import java.time.LocalDate;
import java.util.List;

/**
 * Foundation port for future strategy backtesting, simulation, and ML scoring.
 * Implementations should consume aggregated outcomes — not raw tick data.
 */
public interface BacktestDataPort {

    List<SignalOutcome> outcomesBetween(LocalDate start, LocalDate end);

    double setupWinRate(String setupType, int lookbackDays);
}
