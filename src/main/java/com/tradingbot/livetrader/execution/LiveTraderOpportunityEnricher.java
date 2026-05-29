package com.tradingbot.livetrader.execution;

import com.tradingbot.intelligence.live.LiveScannerRollingCache;
import com.tradingbot.intelligence.live.LiveSymbolScanState;
import com.tradingbot.intelligence.live.MarketSessionClock;
import com.tradingbot.intelligence.snapshot.dto.IntelligenceSnapshotDtos.ScannerOpportunityDto;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.bearish.BearishOperationalService;
import com.tradingbot.bearishassist.BearishAssistService;
import com.tradingbot.executionintelligence.ExecutionIntelligenceCoordinator;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import org.springframework.stereotype.Component;

import java.util.Locale;

/** Phase 188 — enrich ranked opportunities with execution intelligence fields. */
@Component
public class LiveTraderOpportunityEnricher {

    private final ExecutionQualityEngine qualityEngine;
    private final TradeLifecycleEngine lifecycleEngine;
    private final RegimeReliabilityEngine reliabilityEngine;
    private final LiveScannerRollingCache rollingCache;
    private final MarketSessionClock sessionClock;
    private final SymbolContextRegistry symbolContextRegistry;
    private final ExecutionIntelligenceCoordinator executionIntelligence;
    private final BearishAssistService bearishAssistService;
    private final BearishOperationalService bearishOperationalService;

    public LiveTraderOpportunityEnricher(
            ExecutionQualityEngine qualityEngine,
            TradeLifecycleEngine lifecycleEngine,
            RegimeReliabilityEngine reliabilityEngine,
            LiveScannerRollingCache rollingCache,
            MarketSessionClock sessionClock,
            SymbolContextRegistry symbolContextRegistry,
            ExecutionIntelligenceCoordinator executionIntelligence,
            BearishAssistService bearishAssistService,
            BearishOperationalService bearishOperationalService
    ) {
        this.qualityEngine = qualityEngine;
        this.lifecycleEngine = lifecycleEngine;
        this.reliabilityEngine = reliabilityEngine;
        this.rollingCache = rollingCache;
        this.sessionClock = sessionClock;
        this.symbolContextRegistry = symbolContextRegistry;
        this.executionIntelligence = executionIntelligence;
        this.bearishAssistService = bearishAssistService;
        this.bearishOperationalService = bearishOperationalService;
    }

    public LiveTraderDtos.RankedOpportunityDto enrichFromScanner(
            String symbol,
            String regime,
            String action,
            String tone,
            String badge,
            int conviction,
            int velocity,
            int persistence,
            int institutional,
            int expansion,
            int dominance,
            java.util.List<String> whyNow,
            String entryZone,
            String risk,
            boolean emerging,
            boolean degrading,
            ScannerOpportunityDto card
    ) {
        double rvol = card.rvolLabel() != null && card.rvolLabel().contains("x")
                ? parseRvol(card.rvolLabel()) : 1.0;
        SymbolContext ctx = symbolContextRegistry.get(symbol);
        if (ctx != null && ctx.getRelativeVolume() != null && ctx.getRelativeVolume() > 0) {
            rvol = ctx.getRelativeVolume();
        }
        int exhaustion = card.exhaustionProbability();
        String maturity = mapMaturity(conviction, persistence);

        ExecutionQuality quality = qualityEngine.evaluate(
                conviction, dominance, persistence, rvol, velocity, expansion, institutional, exhaustion, regime, maturity);
        TradeLifecyclePhase lifecycle = lifecycleEngine.evaluate(
                conviction, dominance, persistence, velocity, expansion, exhaustion, regime, maturity, false);
        String velocityTrend = lifecycleEngine.velocityTrend(velocity);
        int reliabilityBoost = reliabilityEngine.reliabilityBoost(regime);
        int adjustedDominance = dominance + reliabilityBoost;

        LiveSymbolScanState state = rollingCache.stateFor(symbol);
        String freshness = freshness(state.lastEvalMs(), ctx);
        boolean marketAligned = tone != null && !tone.equals("RED") && conviction >= 50;

        ZonePlan zones = planZones(ctx, conviction, regime);

        LiveTraderDtos.RankedOpportunityDto base = new LiveTraderDtos.RankedOpportunityDto(
                symbol, regime, action, tone, badge, maturity,
                conviction, velocity, persistence, institutional, expansion,
                adjustedDominance, whyNow, entryZone, risk, emerging, degrading,
                System.currentTimeMillis(),
                quality.name(),
                lifecycle.name(),
                velocityTrend,
                rvol,
                zones.stopLabel(),
                zones.targetLabel(),
                zones.projectedR(),
                freshness,
                reliabilityBoost,
                marketAligned,
                state.lastEvalMs(),
                null,
                null
        );
        return bearishOperationalService.applyToOpportunity(applyBearishAssist(applyIntelligence(base)));
    }

    private LiveTraderDtos.RankedOpportunityDto applyIntelligence(LiveTraderDtos.RankedOpportunityDto base) {
        var snap = executionIntelligence.assess(base);
        return new LiveTraderDtos.RankedOpportunityDto(
                base.symbol(), base.regime(), base.action(), base.tone(), base.badge(), base.maturityState(),
                snap.adjustedConviction(), base.convictionVelocity(), base.persistenceSeconds(),
                base.institutionalPressure(), base.expansionProbability(), snap.adjustedDominance(),
                base.whyNow(), base.entryZoneLabel(), base.riskLabel(), base.emergingFast(), base.degrading(),
                base.updatedAt(), base.executionQuality(), base.tradeLifecycle(), base.velocityTrend(),
                base.rvol(), base.stopLabel(), base.targetLabel(), base.projectedR(), base.dataFreshness(),
                base.reliabilityBoost(), base.marketAligned(), base.lastTickMs(), base.putAssist(), base.bearishOps()
        );
    }

    private LiveTraderDtos.RankedOpportunityDto applyBearishAssist(LiveTraderDtos.RankedOpportunityDto base) {
        LiveTraderDtos.PutAssistAdvisoryDto assist = bearishAssistService.evaluateForOpportunity(base);
        return base.withPutAssist(assist);
    }

    public LiveTraderDtos.RankedOpportunityDto enrichFromFeed(
            String symbol,
            String regime,
            String action,
            String tone,
            String badge,
            String maturityState,
            int conviction,
            int velocity,
            int persistenceSeconds,
            int institutional,
            int expansion,
            int dominance,
            java.util.List<String> whyNow,
            String entryZone,
            String risk,
            boolean emerging,
            boolean degrading,
            long updatedAt
    ) {
        SymbolContext ctx = symbolContextRegistry.get(symbol);
        double rvol = ctx != null && ctx.getRelativeVolume() != null && ctx.getRelativeVolume() > 0
                ? ctx.getRelativeVolume() : 1.0;
        int exhaustion = 0;
        ExecutionQuality quality = qualityEngine.evaluate(
                conviction, dominance, persistenceSeconds, rvol, velocity, expansion, institutional, exhaustion, regime, maturityState);
        TradeLifecyclePhase lifecycle = lifecycleEngine.evaluate(
                conviction, dominance, persistenceSeconds, velocity, expansion, exhaustion, regime, maturityState, false);
        LiveSymbolScanState state = rollingCache.stateFor(symbol);
        ZonePlan zones = planZones(ctx, conviction, regime);
        LiveTraderDtos.RankedOpportunityDto base = new LiveTraderDtos.RankedOpportunityDto(
                symbol, regime, action, tone, badge, maturityState,
                conviction, velocity, persistenceSeconds, institutional, expansion,
                dominance + reliabilityEngine.reliabilityBoost(regime),
                whyNow, entryZone, risk, emerging, degrading, updatedAt,
                quality.name(), lifecycle.name(), lifecycleEngine.velocityTrend(velocity),
                rvol, zones.stopLabel(), zones.targetLabel(), zones.projectedR(),
                freshness(state.lastEvalMs(), ctx), reliabilityEngine.reliabilityBoost(regime),
                tone != null && !tone.equals("RED"), state.lastEvalMs(),
                null,
                null
        );
        return bearishOperationalService.applyToOpportunity(applyBearishAssist(applyIntelligence(base)));
    }

    private static String mapMaturity(int conviction, int persistence) {
        if (conviction >= 78 && persistence >= 65) return "CONFIRMED";
        if (conviction >= 65) return "CONFIRMING";
        return "DEVELOPING";
    }

    private static String freshness(long lastEvalMs, SymbolContext ctx) {
        long age = lastEvalMs > 0 ? System.currentTimeMillis() - lastEvalMs : Long.MAX_VALUE;
        if (age > 15_000) return "STALE";
        if (ctx != null && ctx.getLastUpdate() != null
                && java.time.Duration.between(ctx.getLastUpdate(), java.time.Instant.now()).toMillis() > 8_000) {
            return "DELAYED";
        }
        return "LIVE";
    }

    private static double parseRvol(String label) {
        try {
            String n = label.replaceAll("[^0-9.]", "");
            return n.isBlank() ? 1.0 : Double.parseDouble(n);
        } catch (Exception e) {
            return 1.0;
        }
    }

    private ZonePlan planZones(SymbolContext ctx, int conviction, String regime) {
        if (ctx == null) return ZonePlan.empty();
        Double lp = ctx.getLastPrice();
        double price = lp != null && lp > 0 ? lp : 0;
        double atr = price * 0.012;
        if (price <= 0) return ZonePlan.empty();
        double stop = price - atr * 0.6;
        double mult = regime != null && regime.toUpperCase(Locale.US).contains("COMPRESSION") ? 2.2 : 1.5;
        double target = price + atr * mult;
        double risk = Math.max(price - stop, 0.01);
        double projR = (target - price) / risk;
        return new ZonePlan(
                String.format(Locale.US, "%.2f", stop),
                String.format(Locale.US, "%.2f", target),
                String.format(Locale.US, "%.1fR", projR)
        );
    }

    private record ZonePlan(String stopLabel, String targetLabel, String projectedR) {
        static ZonePlan empty() {
            return new ZonePlan("—", "—", "—");
        }
    }
}
