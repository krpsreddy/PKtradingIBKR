package com.tradingbot.bearishassist;

import com.tradingbot.decisiontrace.DecisionTraceService;
import com.tradingbot.executionintelligence.ExecutionIntelligenceCoordinator;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.marketstructure.MarketStructureAssessment;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicReference;

/**
 * Phase 202 — discretionary PUT assist facade (no auto short execution).
 */
@Service
@RequiredArgsConstructor
public class BearishAssistService {

    private final PutAssistEvaluator putAssistEvaluator;
    private final SymbolContextRegistry symbolContextRegistry;
    private final ExecutionIntelligenceCoordinator intelligenceCoordinator;
    private final BearishAssistTelemetryService telemetryService;
    private final DecisionTraceService decisionTraceService;

    private final AtomicReference<BearishAssistMode> mode =
            new AtomicReference<>(BearishAssistMode.LONG_PLUS_PUT_ASSIST);

    @Value("${live-trader.bearish-assist-mode:LONG_PLUS_PUT_ASSIST}")
    private String configuredMode;

    @PostConstruct
    void initMode() {
        mode.set(parseMode(configuredMode));
    }

    public BearishAssistMode getMode() {
        return mode.get();
    }

    public BearishAssistMode setMode(BearishAssistMode next) {
        if (next == null || next == BearishAssistMode.FULL_SHORT_EXECUTION) {
            next = BearishAssistMode.LONG_ONLY;
        }
        mode.set(next);
        return next;
    }

    public LiveTraderDtos.PutAssistAdvisoryDto evaluateForOpportunity(LiveTraderDtos.RankedOpportunityDto opp) {
        if (mode.get() != BearishAssistMode.LONG_PLUS_PUT_ASSIST) {
            return null;
        }
        SymbolContext ctx = symbolContextRegistry.get(opp.symbol());
        MarketStructureAssessment market = intelligenceCoordinator.currentMarketStructure();
        int exhaustion = inferExhaustion(opp);
        PutAssistAssessment assessment = putAssistEvaluator.evaluate(opp, ctx, market, exhaustion);
        LiveTraderDtos.PutAssistAdvisoryDto dto = toDto(assessment);

        if (assessment.active()) {
            telemetryService.recordTrigger(opp, assessment);
            decisionTraceService.tracePutAssist(opp, assessment, market);
        }
        return dto;
    }

    private static LiveTraderDtos.PutAssistAdvisoryDto toDto(PutAssistAssessment a) {
        return new LiveTraderDtos.PutAssistAdvisoryDto(
                a.active(),
                a.bearishBias(),
                a.bearishState().name(),
                a.breakdownProbability().name(),
                a.confidence().name(),
                a.reasons(),
                a.blockReasons(),
                a.narrative(),
                a.active() ? gradeBadge(a.putAssistGrade()) : null,
                a.putAssistGrade() != null ? a.putAssistGrade().name() : null
        );
    }

    private static String gradeBadge(com.tradingbot.bearish.PutAssistGrade g) {
        if (g == null) return "PUT ASSIST";
        return switch (g) {
            case A_PLUS -> "PUT A+";
            case A -> "PUT A";
            case B -> "PUT B";
            default -> "PUT ASSIST";
        };
    }

    private static int inferExhaustion(LiveTraderDtos.RankedOpportunityDto opp) {
        if (opp.degrading()) return 60;
        String lc = opp.tradeLifecycle() != null ? opp.tradeLifecycle().toUpperCase() : "";
        if (lc.contains("EXHAUST")) return 72;
        return 25;
    }

    public static BearishAssistMode parseMode(String raw) {
        if (raw == null) return BearishAssistMode.LONG_PLUS_PUT_ASSIST;
        try {
            BearishAssistMode m = BearishAssistMode.valueOf(raw.trim().toUpperCase());
            return m == BearishAssistMode.FULL_SHORT_EXECUTION
                    ? BearishAssistMode.LONG_PLUS_PUT_ASSIST : m;
        } catch (Exception e) {
            return BearishAssistMode.LONG_PLUS_PUT_ASSIST;
        }
    }
}
