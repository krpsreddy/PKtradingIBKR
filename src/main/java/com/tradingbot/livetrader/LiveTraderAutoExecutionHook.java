package com.tradingbot.livetrader;

import com.tradingbot.api.dto.PaperProbeRequest;
import com.tradingbot.paper.PaperExecutionMode;
import com.tradingbot.paper.PaperExecutionResearchService;
import com.tradingbot.paper.PaperExecutionStateService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Phase 185B — lightweight paper auto-entry hook (1-share, qualified regimes only). */
@Service
@RequiredArgsConstructor
public class LiveTraderAutoExecutionHook {

    private final PaperExecutionResearchService researchService;
    private final PaperExecutionStateService paperStateService;
    private final LiveTraderRuntimeState runtimeState;

    private final Map<String, Instant> lastProbeBySymbol = new ConcurrentHashMap<>();

    public void maybeExecute(LiveTraderDtos.Tier1SnapshotDto tier1) {
        if (!runtimeState.isAutoExecutionEnabled()) return;
        if (runtimeState.getExecutionMode() != PaperExecutionMode.PAPER_RESEARCH) return;
        if (!paperStateService.isResearchInfrastructureEnabled()) return;
        if (tier1.topRanked() == null) return;

        for (LiveTraderDtos.RankedOpportunityDto opp : tier1.topRanked()) {
            if (opp.degrading()) continue;
            if (opp.conviction() < 60) continue;
            Instant last = lastProbeBySymbol.get(opp.symbol());
            if (last != null && Instant.now().isBefore(last.plusSeconds(1800))) continue;

            researchService.submitProbe(new PaperProbeRequest(
                    opp.symbol(),
                    opp.regime(),
                    "LIVE_TRADER",
                    null,
                    opp.conviction(),
                    opp.institutionalPressure(),
                    opp.expansionProbability()
            ));
            lastProbeBySymbol.put(opp.symbol(), Instant.now());
        }
    }
}
