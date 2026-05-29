package com.tradingbot.execution.paperintelligence.stop;

import com.tradingbot.execution.paperintelligence.StopType;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.symbol.SymbolContext;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

@Component
public class StructuralInitialStopEngine {

    public StructuralStopPlan plan(
            LiveTraderDtos.RankedOpportunityDto opp,
            SymbolContext ctx,
            BigDecimal fillPrice
    ) {
        if (fillPrice == null || fillPrice.compareTo(BigDecimal.ZERO) <= 0) {
            return new StructuralStopPlan(null, StopType.ATR, BigDecimal.ZERO, "No fill price");
        }
        double px = fillPrice.doubleValue();
        double atr = px * 0.012;
        String regime = opp.regime() != null ? opp.regime().toUpperCase(Locale.US) : "";

        StopType type = StopType.ATR;
        double stop = px - atr * 0.65;
        String reason = "ATR structural buffer";

        if (ctx != null && ctx.getLiveVwap() != null && ctx.getLastPrice() != null
                && ctx.getLastPrice() < ctx.getLiveVwap().doubleValue()) {
            type = StopType.VWAP;
            stop = ctx.getLiveVwap().doubleValue() - atr * 0.2;
            reason = "Below VWAP — stop under reclaim";
        } else if (regime.contains("FAIL") || regime.contains("RECLAIM")) {
            type = StopType.FAILED_RECLAIM;
            stop = px - atr * 0.35;
            reason = "Failed reclaim invalidation";
        } else if (regime.contains("COMPRESSION")) {
            type = StopType.COMPRESSION_LOW;
            stop = px - atr * 0.5;
            reason = "Compression base";
        } else if (opp.persistenceSeconds() >= 90) {
            type = StopType.HIGHER_LOW;
            stop = px - atr * 0.45;
            reason = "Higher-low trail anchor";
        }

        BigDecimal stopBd = BigDecimal.valueOf(stop).setScale(4, RoundingMode.HALF_UP);
        BigDecimal risk = fillPrice.subtract(stopBd).max(BigDecimal.valueOf(0.01));
        return new StructuralStopPlan(stopBd, type, risk, reason);
    }
}
