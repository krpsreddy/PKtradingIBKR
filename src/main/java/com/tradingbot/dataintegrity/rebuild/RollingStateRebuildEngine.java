package com.tradingbot.dataintegrity.rebuild;

import com.tradingbot.intelligence.live.LiveScannerRollingCache;
import com.tradingbot.models.Candle;
import com.tradingbot.sessionintelligence.PremarketIntelligenceService;
import com.tradingbot.symbol.SymbolContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/** Phase 212 — incremental rolling state rebuild after gap recovery. */
@Slf4j
@Component
@RequiredArgsConstructor
public class RollingStateRebuildEngine {

    private final LiveScannerRollingCache rollingCache;
    private final PremarketIntelligenceService premarketIntelligenceService;

    public void rebuildSymbol(String symbol, SymbolContext ctx, List<Candle> sessionCandles, int continuityScore) {
        if (ctx != null) {
            rebuildSymbolContext(ctx, sessionCandles);
        }
        rollingCache.stateFor(symbol).rebuildFromCandles(continuityScore);
        if (premarketIntelligenceService.enabled()) {
            try {
                premarketIntelligenceService.refreshSymbol(symbol);
            } catch (Exception e) {
                log.debug("PM rebuild skipped for {}: {}", symbol, e.getMessage());
            }
        }
    }

    public void resetLifecycle(String symbol) {
        rollingCache.stateFor(symbol).rebuildFromCandles(0);
    }

    private static void rebuildSymbolContext(SymbolContext ctx, List<Candle> sessionCandles) {
        if (sessionCandles == null || sessionCandles.isEmpty()) {
            return;
        }
        BigDecimal vwap = computeVwap(sessionCandles);
        Double rvol = estimateRvol(sessionCandles);
        ctx.setLiveVwap(vwap);
        ctx.setLiveEstimatedRvol(rvol);
        ctx.invalidateCache();
    }

    private static BigDecimal computeVwap(List<Candle> candles) {
        BigDecimal pv = BigDecimal.ZERO;
        long vol = 0;
        for (Candle c : candles) {
            if (c.getClose() == null || c.getVolume() == null || c.getVolume() <= 0) continue;
            long v = c.getVolume();
            BigDecimal typical = c.getHigh().add(c.getLow()).add(c.getClose())
                    .divide(BigDecimal.valueOf(3), 6, RoundingMode.HALF_UP);
            pv = pv.add(typical.multiply(BigDecimal.valueOf(v)));
            vol += v;
        }
        if (vol == 0) return null;
        return pv.divide(BigDecimal.valueOf(vol), 4, RoundingMode.HALF_UP);
    }

    private static Double estimateRvol(List<Candle> candles) {
        if (candles.size() < 3) return null;
        long lastVol = candles.get(candles.size() - 1).getVolume() != null
                ? candles.get(candles.size() - 1).getVolume() : 0;
        double avg = candles.stream()
                .mapToLong(c -> c.getVolume() != null ? c.getVolume() : 0)
                .average()
                .orElse(0);
        if (avg <= 0) return null;
        return lastVol / avg;
    }
}
