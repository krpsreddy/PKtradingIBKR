package com.tradingbot.ibkr.stream;

import com.tradingbot.intelligence.live.LiveScannerRollingCache;
import com.tradingbot.intelligence.live.LiveScannerService;
import com.tradingbot.intelligence.live.LiveSymbolScanState;
import com.tradingbot.intelligence.snapshot.dto.IntelligenceSnapshotDtos.ScannerOpportunityDto;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.livetrader.execution.TradeLifecyclePhase;
import com.tradingbot.livetrader.portfolio.OrchestrationState;
import com.tradingbot.livetrader.portfolio.OpportunityQueueService;
import com.tradingbot.livetrader.portfolio.QueuedOpportunity;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.models.TradingSymbol;
import com.tradingbot.paper.PaperExecutionResearchService;
import com.tradingbot.services.TradingSymbolService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Phase 194 — scores watchlist symbols for realtime vs snapshot vs dormant tiers.
 */
@Component
@RequiredArgsConstructor
public class StreamPriorityEngine {

    private final LiveStreamProperties streamProperties;
    private final TradingSymbolService tradingSymbolService;
    private final LiveScannerService liveScannerService;
    private final LiveScannerRollingCache rollingCache;
    private final PaperExecutionResearchService paperResearchService;
    private final OpportunityQueueService opportunityQueueService;

    public List<SymbolStreamAllocation> computeAllocations(int maxRealtimeSlots, int maxSnapshotSlots) {
        Set<String> universe = tradingSymbolService.getEnabledSymbolSet();
        if (universe.isEmpty()) {
            return List.of();
        }

        Set<String> activePositions = new HashSet<>();
        for (PaperExecutionRecord r : paperResearchService.activeRecords()) {
            if (r.getSymbol() != null) {
                activePositions.add(r.getSymbol().toUpperCase(Locale.US));
            }
        }

        Map<String, OrchestrationState> orchBySymbol = new HashMap<>();
        Map<String, QueuedOpportunity> queued = new HashMap<>();
        for (QueuedOpportunity q : opportunityQueueService.all()) {
            String sym = q.symbol().toUpperCase(Locale.US);
            orchBySymbol.put(sym, q.state());
            queued.put(sym, q);
        }

        var scanner = liveScannerService.currentSnapshot();
        Map<String, ScannerOpportunityDto> scanBySymbol = new HashMap<>();
        Map<String, Integer> scanRank = new HashMap<>();
        int rank = 0;
        for (ScannerOpportunityDto o : scanner.opportunities()) {
            String sym = o.symbol().toUpperCase(Locale.US);
            scanBySymbol.putIfAbsent(sym, o);
            scanRank.putIfAbsent(sym, rank++);
        }

        List<Scored> scored = new ArrayList<>();
        long now = System.currentTimeMillis();
        long dormantCutoff = now - streamProperties.getInactiveDormantMinutes() * 60_000L;

        for (String sym : universe) {
            TradingSymbol row = tradingSymbolService.findActive(sym).orElse(null);
            if (row == null) {
                continue;
            }

            LiveSymbolScanState state = rollingCache.stateFor(sym);
            ScannerOpportunityDto scan = scanBySymbol.get(sym);
            int dominance = state.dominanceScore();
            if (scan != null && scan.convictionScore() > 0) {
                dominance = Math.max(dominance, scan.convictionScore());
            }

            int score = 0;
            StreamAllocationReason reason = StreamAllocationReason.LOW_PRIORITY;

            if (activePositions.contains(sym)) {
                score += 10_000;
                reason = StreamAllocationReason.ACTIVE_POSITION;
            }

            OrchestrationState orch = orchBySymbol.get(sym);
            if (orch == OrchestrationState.QUEUE) {
                score += 7_000;
                reason = StreamAllocationReason.QUEUE;
            } else if (orch == OrchestrationState.REPLACEMENT_CANDIDATE) {
                score += 6_500;
                reason = StreamAllocationReason.REPLACEMENT;
            } else if (orch == OrchestrationState.ACTIVE) {
                score += 8_000;
                reason = StreamAllocationReason.ACTIVE_POSITION;
            }

            if (dominance >= streamProperties.getDominanceRealtimeThreshold()) {
                score += 4_000;
                if (reason == StreamAllocationReason.LOW_PRIORITY) {
                    reason = StreamAllocationReason.DOMINANT;
                }
            }

            Integer rIdx = scanRank.get(sym);
            if (rIdx != null && rIdx < streamProperties.getScannerTopRealtimeSlots()) {
                score += 3_500 - (rIdx * 200);
                if (reason == StreamAllocationReason.LOW_PRIORITY) {
                    reason = StreamAllocationReason.SCAN_TOP;
                }
            }

            if (state.convictionVelocity() >= 8) {
                score += 2_500;
                reason = StreamAllocationReason.EMERGING;
            }

            String lifecycle = "";
            QueuedOpportunity q = queued.get(sym);
            if (q != null && q.tradeLifecycle() != null) {
                lifecycle = q.tradeLifecycle();
            }
            if (!lifecycle.isBlank()) {
                String lc = lifecycle.toUpperCase(Locale.US);
                if (lc.contains("PERSIST")) {
                    score += 2_000;
                }
                if (lc.contains("EXTENDED")) {
                    score -= 1_500;
                }
                if (lc.contains("EXHAUST") || lc.contains("FAIL")) {
                    score -= 3_000;
                    reason = StreamAllocationReason.EXHAUSTED;
                }
            }

            if (scan != null) {
                if (scan.continuationPersistence() < 45) {
                    score -= 400;
                }
                String rvolLabel = scan.rvolLabel();
                if (rvolLabel != null && (rvolLabel.contains("LOW") || rvolLabel.contains("WEAK"))) {
                    score -= 300;
                }
            }
            if (q != null && q.rvol() < 1.0) {
                score -= 300;
            }

            if (state.lastEvalMs() > 0 && state.lastEvalMs() < dormantCutoff && score < 3_000 && !row.isSubscribeLive()) {
                score -= 2_000;
            }

            // Phase 216 — infrastructure baseline (independent of scanner ON/OFF)
            if (row.isSubscribeLive()) {
                score += 2_500;
                if (reason == StreamAllocationReason.LOW_PRIORITY) {
                    reason = StreamAllocationReason.PINNED;
                }
            }
            if (row.isPinned()) {
                score += 800;
            }

            String lifecycleLabel = !lifecycle.isBlank()
                    ? lifecycle
                    : TradeLifecyclePhase.DEVELOPING.name();

            scored.add(new Scored(sym, score, reason, dominance, lifecycleLabel));
        }

        scored.sort(Comparator.comparingInt(Scored::score).reversed().thenComparing(Scored::symbol));

        int rtCap = Math.max(0, maxRealtimeSlots);
        int snapCap = Math.max(0, maxSnapshotSlots);
        List<SymbolStreamAllocation> out = new ArrayList<>();

        for (int i = 0; i < scored.size(); i++) {
            Scored s = scored.get(i);
            LiveStreamTier tier;
            if (i < rtCap && s.score() > 0) {
                tier = LiveStreamTier.REALTIME;
            } else if (i < rtCap + snapCap) {
                tier = LiveStreamTier.SNAPSHOT;
                if (s.reason() == StreamAllocationReason.EXHAUSTED) {
                    tier = LiveStreamTier.DORMANT;
                }
            } else {
                tier = LiveStreamTier.DORMANT;
                if (s.reason() != StreamAllocationReason.ACTIVE_POSITION
                        && s.reason() != StreamAllocationReason.QUEUE
                        && s.reason() != StreamAllocationReason.REPLACEMENT) {
                    s = new Scored(s.symbol(), s.score(), StreamAllocationReason.DORMANT_IDLE, s.dominance(), s.lifecycle());
                }
            }
            out.add(new SymbolStreamAllocation(
                    s.symbol(),
                    tier,
                    s.reason(),
                    s.score(),
                    s.dominance(),
                    s.lifecycle(),
                    false
            ));
        }
        return out;
    }

    private record Scored(String symbol, int score, StreamAllocationReason reason, int dominance, String lifecycle) {}
}
