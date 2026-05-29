package com.tradingbot.execution.paperintelligence.trailing;

import com.tradingbot.execution.paperintelligence.ExecutionDeteriorationState;
import com.tradingbot.livetrader.LiveTraderDtos;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Phase 210 — lifecycle structural trailing (no fixed % trail). */
@Component
public class StructuralTrailingStopEngine {

    public TrailingStopPlan evaluate(
            String lifecyclePhase,
            ExecutionDeteriorationState deterioration,
            BigDecimal fillPrice,
            BigDecimal structuralStop,
            BigDecimal currentPrice,
            int persistence,
            int velocity,
            int exhaustion
    ) {
        if (fillPrice == null || fillPrice.compareTo(BigDecimal.ZERO) <= 0) {
            return new TrailingStopPlan(structuralStop, 0, "No fill", deterioration.name());
        }
        double px = currentPrice != null ? currentPrice.doubleValue() : fillPrice.doubleValue();
        double atr = px * 0.012;
        double base = structuralStop != null ? structuralStop.doubleValue() : px - atr;

        double trail = base;
        int tightness = 30;
        String reason = "Structural baseline";

        String phase = lifecyclePhase != null ? lifecyclePhase.toUpperCase() : "DEVELOPING";
        switch (phase) {
            case "DEVELOPING" -> {
                trail = px - atr * 0.85;
                tightness = 20;
                reason = "Wide — developing noise buffer";
            }
            case "CONFIRMED" -> {
                trail = px - atr * 0.65;
                tightness = 40;
                reason = "Confirmed — slight tighten";
            }
            case "PERSISTING", "SECOND_LEG" -> {
                trail = px - atr * 0.45;
                tightness = persistence >= 120 ? 65 : 55;
                reason = "Persistence trail higher-low";
            }
            case "EXTENDED", "EXHAUSTING" -> {
                trail = px - atr * 0.32;
                tightness = 75;
                reason = "Extended — aggressive protection";
            }
            case "FAILED", "COLLAPSING" -> {
                trail = px - atr * 0.15;
                tightness = 95;
                reason = "Defensive — structure failed";
            }
            default -> trail = px - atr * 0.55;
        }

        if (velocity < -5) {
            trail = Math.max(trail, px - atr * 0.35);
            tightness += 12;
            reason += " · velocity decay";
        }
        if (exhaustion >= 60) {
            trail = Math.max(trail, px - atr * 0.28);
            tightness += 15;
            reason += " · exhaustion";
        }

        String detAdj = "NONE";
        if (deterioration == ExecutionDeteriorationState.SOFTENING) {
            trail = Math.max(trail, px - atr * 0.4);
            tightness += 10;
            detAdj = "SOFTENING";
        } else if (deterioration == ExecutionDeteriorationState.DETERIORATING) {
            trail = Math.max(trail, px - atr * 0.25);
            tightness += 25;
            detAdj = "DETERIORATING";
        } else if (deterioration == ExecutionDeteriorationState.COLLAPSING) {
            trail = px - atr * 0.08;
            tightness = 100;
            detAdj = "COLLAPSING";
        }

        return new TrailingStopPlan(
                BigDecimal.valueOf(trail).setScale(4, RoundingMode.HALF_UP),
                Math.min(100, tightness),
                reason,
                detAdj
        );
    }

    public boolean stopTriggered(TrailingStopPlan plan, BigDecimal currentPrice) {
        if (plan == null || plan.trailingStop() == null || currentPrice == null) return false;
        return currentPrice.compareTo(plan.trailingStop()) <= 0;
    }
}
