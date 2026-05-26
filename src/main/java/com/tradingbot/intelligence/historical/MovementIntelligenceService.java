package com.tradingbot.intelligence.historical;

import com.tradingbot.api.dto.historical.HistoricalDtos.MovementIntelligenceDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.historical.CandleHistoryService;
import com.tradingbot.models.Candle;
import com.tradingbot.models.SignalOutcome;
import com.tradingbot.repository.SignalOutcomeRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Derives expected move intelligence from underlying 5m candles — no option chains. */
@Service
@RequiredArgsConstructor
public class MovementIntelligenceService {

    private final SignalOutcomeRepository outcomeRepository;
    private final CandleHistoryService candleHistoryService;
    private final TradingProperties tradingProperties;

    public MovementIntelligenceDto analyze(String setupType, String symbol) {
        String setup = SetupStatisticsService.normalize(setupType);
        LocalDate since = MarketTime.nowLocal().toLocalDate().minusDays(tradingProperties.getIntelligenceLookbackDays());
        List<SignalOutcome> outcomes = outcomeRepository.findBySetupTypeAndSessionDateGreaterThanEqual(setup, since);

        Double avgMfe = avg(outcomes.stream().map(SignalOutcome::getMaxFavorableExcursion).filter(java.util.Objects::nonNull).toList());
        Double avgMae = avg(outcomes.stream().map(SignalOutcome::getMaxAdverseExcursion).filter(java.util.Objects::nonNull).toList());
        Double avgCont = avg(outcomes.stream().map(SignalOutcome::getContinuationDistance).filter(java.util.Objects::nonNull).toList());

        long follow = outcomes.stream().filter(o -> Boolean.TRUE.equals(o.getFollowThrough())).count();
        long decided = outcomes.stream().filter(o -> "WIN".equals(o.getOutcome()) || "LOSS".equals(o.getOutcome())).count();
        double persistence = decided > 0 ? (double) follow / decided : estimateFromCandles(symbol, setup);

        double extension = outcomes.stream()
                .map(SignalOutcome::getExtensionDistance)
                .filter(java.util.Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average().orElse(0.04);

        double exhaustion = avgMae != null ? Math.min(1, avgMae * 2) : 0.25;

        List<String> notes = new ArrayList<>();
        if (avgMfe != null) {
            notes.add(String.format(Locale.US, "Average favorable move: %.1f%%", avgMfe * 100));
        } else if (symbol != null) {
            notes.add(String.format(Locale.US, "Estimated move from candles: %.1f%%", estimateFromCandles(symbol, setup) * 100));
        }

        String failTime = setup.contains("OPEN") ? "11:30 ET" : "14:00 ET";

        return MovementIntelligenceDto.builder()
                .setupType(setup)
                .expectedMovePercent(avgMfe != null ? avgMfe * 100 : null)
                .reversalMovePercent(avgMae != null ? avgMae * 100 : null)
                .movePersistenceProbability(persistence)
                .extensionProbability(Math.round(extension * 1000) / 1000.0)
                .exhaustionProbability(Math.round(exhaustion * 1000) / 1000.0)
                .typicalFailureTime(failTime)
                .notes(notes)
                .build();
    }

    /** Compute MFE/MAE from post-entry candles for outcome enrichment. */
    public void enrichOutcomeFromCandles(SignalOutcome outcome, List<Candle> sessionCandles, int entryBarIndex) {
        if (outcome.getEntryPrice() == null || entryBarIndex < 0 || entryBarIndex >= sessionCandles.size()) return;
        double entry = outcome.getEntryPrice().doubleValue();
        if (entry <= 0) return;

        double maxHigh = entry, minLow = entry;
        int horizon = Math.min(sessionCandles.size(), entryBarIndex + 24);
        for (int i = entryBarIndex; i < horizon; i++) {
            Candle c = sessionCandles.get(i);
            maxHigh = Math.max(maxHigh, c.getHigh().doubleValue());
            minLow = Math.min(minLow, c.getLow().doubleValue());
        }
        boolean bullish = outcome.getSignalType() == null || !outcome.getSignalType().contains("FAIL");
        double mfe = bullish ? (maxHigh - entry) / entry : (entry - minLow) / entry;
        double mae = bullish ? (entry - minLow) / entry : (maxHigh - entry) / entry;
        outcome.setMaxFavorableExcursion(Math.max(0, mfe));
        outcome.setMaxAdverseExcursion(Math.max(0, mae));
        outcome.setContinuationDistance(mfe);
        outcome.setFollowThrough(mfe >= 0.015);
        if (mae > 0.01) outcome.setFailureDistance(mae);
    }

    private double estimateFromCandles(String symbol, String setup) {
        if (symbol == null) return 0.5;
        List<Candle> candles = candleHistoryService.loadSessionCandles(symbol);
        if (candles.size() < 20) return 0.5;
        int moves = 0, follow = 0;
        for (int i = 1; i < candles.size() - 6; i += 6) {
            double open = candles.get(i).getOpen().doubleValue();
            double later = candles.get(i + 5).getClose().doubleValue();
            if (open <= 0) continue;
            double move = (later - open) / open;
            moves++;
            if (setup.contains("FAIL") ? move < -0.005 : move > 0.005) follow++;
        }
        return moves > 0 ? (double) follow / moves : 0.5;
    }

    private Double avg(List<Double> vals) {
        if (vals.isEmpty()) return null;
        return vals.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    }
}
