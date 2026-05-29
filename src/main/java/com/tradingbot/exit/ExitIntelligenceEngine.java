package com.tradingbot.exit;

import com.tradingbot.livetrader.execution.TradeLifecyclePhase;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

/**
 * Phase 198 — adaptive continuation exits (not fixed RR).
 */
@Component
@RequiredArgsConstructor
public class ExitIntelligenceEngine {

    private final SymbolContextRegistry symbolContextRegistry;

    public ExitIntelligenceAssessment evaluateOpenPosition(
            PaperExecutionRecord record,
            int liveDominance,
            int livePersistence,
            int liveVelocity,
            double liveRvol,
            int liveExhaustion,
            String liveLifecycle
    ) {
        BigDecimal mfe = record.getMfeR();
        BigDecimal mae = record.getMaeR();
        BigDecimal unrealized = currentUnrealizedR(record);

        if (liveLifecycle != null && liveLifecycle.toUpperCase(Locale.US).contains("FAIL")) {
            return close(ExitState.PERSISTENCE_FAILURE, "Lifecycle failed");
        }
        if (liveExhaustion >= 68) {
            return close(ExitState.EXHAUSTION_EXIT, "Exhaustion probability critical");
        }
        if (liveVelocity <= -8 && livePersistence < 30) {
            return close(ExitState.PERSISTENCE_FAILURE, "Persistence collapse + velocity decay");
        }
        if (vwapFailed(record.getSymbol())) {
            return close(ExitState.VWAP_FAILURE, "Price lost VWAP acceptance");
        }

        if (mfe != null && mfe.compareTo(new BigDecimal("0.35")) >= 0
                && liveLifecycle != null
                && liveLifecycle.contains(TradeLifecyclePhase.SECOND_LEG.name())) {
            return hold(ExitState.SECOND_LEG_ACTIVE, "Second leg active — trail", 0.25);
        }

        if (mfe != null && mfe.compareTo(new BigDecimal("0.5")) >= 0 && liveDominance >= 90) {
            return hold(ExitState.TRAIL, "Trail winner", 0.35);
        }

        if (unrealized != null && unrealized.compareTo(new BigDecimal("-0.45")) <= 0) {
            return close(ExitState.EXIT_CRITICAL, "Risk breach");
        }

        if (mfe != null && mfe.compareTo(new BigDecimal("0.4")) >= 0
                && unrealized != null
                && mfe.subtract(unrealized).compareTo(new BigDecimal("0.35")) >= 0) {
            return close(ExitState.EXIT_WARNING, "Gave back continuation — protect gains");
        }

        if (liveDominance < 70 && livePersistence < 40 && mfe != null && mfe.compareTo(new BigDecimal("0.15")) > 0) {
            return close(ExitState.REDUCE_RISK, "Dominance faded after partial move");
        }

        if (mae != null && mae.compareTo(new BigDecimal("-0.25")) <= 0 && liveRvol < 1.0) {
            return advisory(ExitState.REDUCE_RISK, "Weak RVOL underwater");
        }

        return hold(ExitState.HOLD, "Continuation intact", 0);
    }

    private boolean vwapFailed(String symbol) {
        SymbolContext ctx = symbolContextRegistry.get(symbol);
        if (ctx == null || ctx.getLastPrice() == null || ctx.getLiveVwap() == null) return false;
        return ctx.getLastPrice() < ctx.getLiveVwap().doubleValue() * 0.997;
    }

    private BigDecimal currentUnrealizedR(PaperExecutionRecord record) {
        if (record.getFillPrice() == null || record.getFillPrice().compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        Double last = symbolContextRegistry.get(record.getSymbol()) != null
                ? symbolContextRegistry.get(record.getSymbol()).getLastPrice()
                : null;
        if (last == null || last <= 0) return null;
        return BigDecimal.valueOf(last)
                .subtract(record.getFillPrice())
                .divide(record.getFillPrice(), 4, RoundingMode.HALF_UP);
    }

    private ExitIntelligenceAssessment hold(ExitState state, String reason, double trailR) {
        return new ExitIntelligenceAssessment(state, false, reason, trailR);
    }

    private ExitIntelligenceAssessment advisory(ExitState state, String reason) {
        return new ExitIntelligenceAssessment(state, false, reason, 0);
    }

    private ExitIntelligenceAssessment close(ExitState state, String reason) {
        return new ExitIntelligenceAssessment(state, true, reason, 0);
    }
}
