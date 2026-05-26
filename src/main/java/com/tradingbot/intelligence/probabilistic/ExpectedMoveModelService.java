package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.ExpectedMoveDto;
import com.tradingbot.historical.CandleHistoryService;
import com.tradingbot.intelligence.historical.MovementIntelligenceService;
import com.tradingbot.intelligence.historical.SetupStatisticsService;
import com.tradingbot.models.Candle;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ExpectedMoveModelService {

    private final MovementIntelligenceService movementIntelligenceService;
    private final CandleHistoryService candleHistoryService;

    public ExpectedMoveDto model(String setupType, String symbol, String regime) {
        String setup = SetupStatisticsService.normalize(setupType);
        var movement = movementIntelligenceService.analyze(setup, symbol);

        double base = movement.getExpectedMovePercent() != null
                ? movement.getExpectedMovePercent() / 100.0
                : estimateFromCandles(symbol, setup);
        double low = base * 0.75;
        double high = base * 1.35;

        String summary;
        if (setup.contains("OPEN_MOM") || setup.contains("OPEN")) {
            summary = String.format(Locale.US, "%s on %s: Typical move %.1f–%.1f%%",
                    setup, symbol != null ? symbol : "sector", low * 100, high * 100);
        } else if (setup.contains("FAIL")) {
            summary = String.format(Locale.US, "%s: Typical retracement %.1f%%",
                    setup, (movement.getReversalMovePercent() != null ? movement.getReversalMovePercent() : base * 100));
        } else {
            summary = String.format(Locale.US, "%s: Average continuation %.1f%%",
                    setup, (movement.getExpectedMovePercent() != null ? movement.getExpectedMovePercent() : base * 100));
        }

        return ExpectedMoveDto.builder()
                .setupType(setup)
                .symbol(symbol)
                .typicalMoveLowPercent(Math.round(low * 1000) / 10.0)
                .typicalMoveHighPercent(Math.round(high * 1000) / 10.0)
                .averageContinuationPercent(movement.getExpectedMovePercent())
                .typicalRetracementPercent(movement.getReversalMovePercent())
                .summary(summary)
                .build();
    }

    private double estimateFromCandles(String symbol, String setup) {
        if (symbol == null) return 0.025;
        List<Candle> candles = candleHistoryService.loadSessionCandles(symbol);
        if (candles.size() < 10) return 0.025;
        double sum = 0;
        int n = 0;
        for (int i = 5; i < Math.min(candles.size(), 60); i += 5) {
            double a = candles.get(i - 5).getClose().doubleValue();
            double b = candles.get(i).getClose().doubleValue();
            if (a > 0) { sum += Math.abs(b - a) / a; n++; }
        }
        return n > 0 ? sum / n : 0.025;
    }
}
