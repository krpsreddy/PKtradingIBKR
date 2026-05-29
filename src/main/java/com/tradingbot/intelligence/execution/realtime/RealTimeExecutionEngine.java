package com.tradingbot.intelligence.execution.realtime;

import com.tradingbot.intelligence.execution.realtime.dto.RealTimeExecutionDtos.*;
import com.tradingbot.services.TradingSymbolService;
import com.tradingbot.services.strategymemory.StrategyMemoryRegistryService;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

/** Phase 167 — multi-speed staged execution intelligence engine. */
@Slf4j
@Service
public class RealTimeExecutionEngine {

    private static final int MAX_TIMELINE = 12;
    private static final int MAX_FEED = 40;

    private final SymbolContextRegistry symbolContextRegistry;
    private final TradingSymbolService tradingSymbolService;
    private final StrategyMemoryRegistryService strategyRegistry;

    private final Map<String, SymbolTickState> tickStates = new ConcurrentHashMap<>();
    private final Map<String, Deque<ConfidencePointDto>> confidenceTimelines = new ConcurrentHashMap<>();
    private final List<ExecutionFeedItemDto> cachedFeed = new CopyOnWriteArrayList<>();
    private final AtomicInteger generation = new AtomicInteger(0);
    private volatile long lastScanAt = 0;

    public RealTimeExecutionEngine(
            SymbolContextRegistry symbolContextRegistry,
            TradingSymbolService tradingSymbolService,
            StrategyMemoryRegistryService strategyRegistry
    ) {
        this.symbolContextRegistry = symbolContextRegistry;
        this.tradingSymbolService = tradingSymbolService;
        this.strategyRegistry = strategyRegistry;
    }

    /** Nano scan tick — lightweight, incremental, no full rescoring. */
    public void nanoScanTick() {
        Set<String> symbols = tradingSymbolService.getEnabledSymbolSet();
        if (symbols.isEmpty()) return;

        long now = System.currentTimeMillis();
        List<ExecutionFeedItemDto> nextFeed = new ArrayList<>();

        for (String symbol : symbols) {
            SymbolContext ctx = symbolContextRegistry.get(symbol);
            if (ctx == null) continue;

            SymbolTickState tick = tickStates.getOrDefault(symbol, SymbolTickState.initial(symbol));
            double rvol = ctx.getLiveEstimatedRvol() != null ? ctx.getLiveEstimatedRvol() : tick.lastRvol();

            // Stage 1: nano anomaly
            NanoAnomalyDetector.NanoAnomalyResult anomaly = NanoAnomalyDetector.detect(ctx, tick);

            // Stage 2: micro persistence
            MicroPersistenceValidator.PersistenceResult persistence =
                    MicroPersistenceValidator.validate(anomaly, tick, now);
            long typeHash = anomaly.opportunityType().hashCode();
            long sinceMs = anomaly.anomalyDetected()
                    ? (tick.anomalySinceMs() == 0 || tick.lastAnomalyTypeHash() != typeHash ? now : tick.anomalySinceMs())
                    : 0;

            // Stage 3: structural (only if anomaly detected)
            StructuralRegimeValidator.StructuralResult structural = anomaly.anomalyDetected()
                    ? StructuralRegimeValidator.validate(ctx, anomaly.opportunityType())
                    : new StructuralRegimeValidator.StructuralResult(false, 40, "NEUTRAL");

            if (anomaly.anomalyDetected()) {
                structural = new StructuralRegimeValidator.StructuralResult(
                        structural.passed(),
                        structural.integrityScore() + MicroPersistenceValidator.structuralBoost(ctx),
                        structural.regimeLabel()
                );
            }

            // Stage 4: score (only escalate symbols with anomaly)
            if (!anomaly.anomalyDetected()) {
                tickStates.put(symbol, tick.withRvol(rvol));
                continue;
            }

            int prevConviction = tick.lastConviction();
            AutonomousExecutionScorer.ScoreResult score = AutonomousExecutionScorer.score(
                    anomaly, persistence, structural, 0);
            int velocity = score.conviction() - prevConviction;
            if (velocity >= 20) {
                score = AutonomousExecutionScorer.score(anomaly, persistence, structural, velocity);
            }

            tickStates.put(symbol, tick
                    .withRvol(rvol)
                    .withConviction(score.conviction(), velocity)
                    .withPersistence(sinceMs, persistence.persistenceSeconds(), typeHash));

            recordConfidence(symbol, now, score.conviction());

            ExecutionFeedItemDto item = buildFeedItem(ctx, anomaly, persistence, structural, score, velocity, now);
            if (item != null) nextFeed.add(item);
        }

        nextFeed = applyCalibratedConviction(nextFeed);
        nextFeed.sort(this::compareFeedItems);
        cachedFeed.clear();
        cachedFeed.addAll(nextFeed.stream().limit(MAX_FEED).toList());
        generation.incrementAndGet();
        lastScanAt = now;
    }

    public ExecutionFeedSnapshotDto snapshot() {
        return new ExecutionFeedSnapshotDto(
                true,
                lastScanAt > 0 ? lastScanAt : System.currentTimeMillis(),
                tradingSymbolService.getScanSymbolSet().size(),
                generation.get(),
                List.copyOf(cachedFeed),
                List.of(
                        "Multi-speed scan: 1s nano → 5–15s persistence → structural confirmation",
                        cachedFeed.size() + " live execution opportunities",
                        "Advisory only — incremental micro-evaluation"
                )
        );
    }

    public Optional<ExecutionFeedItemDto> itemForSymbol(String symbol) {
        String sym = symbol.toUpperCase();
        return cachedFeed.stream().filter(i -> i.symbol().equals(sym)).findFirst();
    }

    private ExecutionFeedItemDto buildFeedItem(
            SymbolContext ctx,
            NanoAnomalyDetector.NanoAnomalyResult anomaly,
            MicroPersistenceValidator.PersistenceResult persistence,
            StructuralRegimeValidator.StructuralResult structural,
            AutonomousExecutionScorer.ScoreResult score,
            int velocity,
            long now
    ) {
        String type = anomaly.opportunityType();
        String action = mapAction(type, score);
        String tone = mapTone(type, score.maturity());
        String badge = mapBadge(type, score.maturity());
        List<String> why = new ArrayList<>(anomaly.signals());
        if (persistence.persistenceSeconds() > 0) {
            why.add("persistence " + persistence.persistenceSeconds() + "s");
        }
        if (velocity > 0) why.add("conviction velocity +" + velocity);

        strategyRegistry.matchOpportunityType(type).ifPresent(s ->
                why.add("strategy " + s.strategyName()));

        String entry = ctx.getLastPrice() != null
                ? String.format("%.2f–%.2f", ctx.getLastPrice() * 0.998, ctx.getLastPrice() * 1.002)
                : "—";

        return new ExecutionFeedItemDto(
                ctx.getSymbol(),
                type,
                action,
                tone,
                badge,
                score.maturity().name(),
                score.mode().name(),
                score.preConfirmation(),
                score.conviction(),
                velocity,
                score.expansionProbability(),
                structural.integrityScore(),
                persistence.persistenceSeconds(),
                why.stream().limit(4).toList(),
                entry,
                type.contains("EXHAUSTION") ? "HIGH" : score.preConfirmation() ? "MODERATE" : "LOW",
                timelineFor(ctx.getSymbol()),
                now
        );
    }

    private void recordConfidence(String symbol, long ts, int conviction) {
        Deque<ConfidencePointDto> deque = confidenceTimelines.computeIfAbsent(symbol, k -> new ArrayDeque<>());
        deque.addLast(new ConfidencePointDto(ts, conviction));
        while (deque.size() > MAX_TIMELINE) deque.removeFirst();
    }

    private List<ConfidencePointDto> timelineFor(String symbol) {
        Deque<ConfidencePointDto> deque = confidenceTimelines.get(symbol);
        return deque == null ? List.of() : List.copyOf(deque);
    }

    private int compareFeedItems(ExecutionFeedItemDto a, ExecutionFeedItemDto b) {
        // Velocity-aware ranking: rising conviction outranks static high
        double rankA = a.conviction() + Math.max(0, a.convictionVelocity()) * 1.5;
        double rankB = b.conviction() + Math.max(0, b.convictionVelocity()) * 1.5;
        if (rankB != rankA) return Double.compare(rankB, rankA);
        if (b.expansionProbability() != a.expansionProbability()) {
            return b.expansionProbability() - a.expansionProbability();
        }
        return b.triggerIntegrity() - a.triggerIntegrity();
    }

    /** Phase 169 — cohort calibration spreads flat conviction clusters. */
    private List<ExecutionFeedItemDto> applyCalibratedConviction(List<ExecutionFeedItemDto> items) {
        if (items.isEmpty()) return items;
        List<ConvictionCalibrationEngine.CalibrationInput> inputs = items.stream()
                .map(i -> ConvictionCalibrationEngine.fromScoreContext(
                        i.triggerIntegrity(),
                        i.expansionProbability(),
                        i.persistenceSeconds(),
                        i.maturityState().contains("EXHAUST") ? 85 : 20,
                        i.convictionVelocity(),
                        i.preConfirmation()
                ))
                .toList();
        List<ConvictionCalibrationEngine.CalibrationResult> calibrated =
                ConvictionCalibrationEngine.calibrateCohort(inputs);
        List<ExecutionFeedItemDto> out = new ArrayList<>(items.size());
        for (int i = 0; i < items.size(); i++) {
            ExecutionFeedItemDto item = items.get(i);
            int conviction = calibrated.get(i).convictionScore();
            out.add(new ExecutionFeedItemDto(
                    item.symbol(), item.opportunityType(), item.action(), item.tone(), item.badge(),
                    item.maturityState(), item.executionMode(), item.preConfirmation(),
                    conviction, item.convictionVelocity(), item.expansionProbability(),
                    item.triggerIntegrity(), item.persistenceSeconds(), item.whyNow(),
                    item.entryZoneLabel(), item.riskLabel(), item.confidenceTimeline(), item.updatedAt()
            ));
        }
        return out;
    }

    private static String mapAction(String type, AutonomousExecutionScorer.ScoreResult score) {
        if (type.contains("EXHAUSTION")) return "AVOID";
        if (score.maturity() == ExecutionMaturityState.CONFIRMED || score.maturity() == ExecutionMaturityState.EXTENDED) {
            return "ENTER";
        }
        if (score.maturity() == ExecutionMaturityState.CONFIRMING) return "WATCH";
        return score.preConfirmation() ? "WAIT" : "WATCH";
    }

    private static String mapTone(String type, ExecutionMaturityState maturity) {
        if (type.contains("EXHAUSTION") || maturity == ExecutionMaturityState.EXHAUSTING) return "RED";
        if (maturity == ExecutionMaturityState.DEVELOPING || maturity == ExecutionMaturityState.CONFIRMING) return "YELLOW";
        if (maturity == ExecutionMaturityState.EXTENDED) return "ORANGE";
        return "GREEN";
    }

    private static String mapBadge(String type, ExecutionMaturityState maturity) {
        String label = type.replace('_', ' ');
        return switch (maturity) {
            case DEVELOPING -> "🟡 " + label + " DEVELOPING";
            case CONFIRMING -> "🟡 " + label + " CONFIRMING";
            case CONFIRMED -> "🟢 " + label + " CONFIRMED";
            case EXTENDED -> "🟠 " + label + " EXTENDED";
            case EXHAUSTING -> "🔴 " + label + " EXHAUSTION DRIFT";
            case FAILED -> "🔴 " + label + " FAILED";
        };
    }
}
