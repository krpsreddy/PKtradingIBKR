package com.tradingbot.livetrader;

import com.tradingbot.api.dto.PaperProbeRequest;
import com.tradingbot.intelligence.situational.MarketHeartbeatService;
import com.tradingbot.livetrader.execution.ExecutionQuality;
import com.tradingbot.livetrader.execution.ExecutionSafetyService;
import com.tradingbot.livetrader.execution.ExecutionTelemetryService;
import com.tradingbot.decisiontrace.DecisionTraceService;
import com.tradingbot.bearish.BearishOperationalService;
import com.tradingbot.executionintelligence.ExecutionIntelligenceCoordinator;
import com.tradingbot.livetrader.portfolio.PortfolioOrchestrationService;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.paper.PaperExecutionMode;
import com.tradingbot.paper.PaperExecutionResearchService;
import com.tradingbot.paper.PaperExecutionStateService;
import com.tradingbot.paper.PaperExecutionStatus;
import com.tradingbot.runtime.RuntimeProfileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Phase 188/189 — autonomous paper via portfolio orchestration (max 1 slot). */
@Slf4j
@Service
@RequiredArgsConstructor
public class LiveTraderAutoExecutionHook {

    private final PaperExecutionResearchService researchService;
    private final PaperExecutionStateService paperStateService;
    private final LiveTraderRuntimeState runtimeState;
    private final ExecutionSafetyService safetyService;
    private final ExecutionTelemetryService telemetryService;
    private final PortfolioOrchestrationService portfolioOrchestrationService;
    private final MarketHeartbeatService marketHeartbeatService;
    private final ExecutionIntelligenceCoordinator executionIntelligence;
    private final DecisionTraceService decisionTraceService;
    private final BearishOperationalService bearishOperationalService;
    private final RuntimeProfileService runtimeProfileService;

    private final Map<String, Instant> lastProbeBySymbol = new ConcurrentHashMap<>();

    public void maybeExecute(LiveTraderDtos.Tier1SnapshotDto tier1) {
        if (!runtimeProfileService.allowsAutoPaper()) return;
        if (!runtimeState.isAutoExecutionEnabled()) return;
        if (runtimeState.getExecutionMode() != PaperExecutionMode.PAPER_RESEARCH) return;
        if (!paperStateService.isResearchInfrastructureEnabled()) return;
        if (tier1.topRanked() == null || tier1.topRanked().isEmpty()) return;

        ExecutionSafetyService.SafetyCheckResult safety = safetyService.checkAutoEntry();
        if (!safety.allowed()) {
            log.debug("Auto paper blocked: {}", safety.reason());
            return;
        }

        var market = marketHeartbeatService.heartbeat();
        var oppOpt = portfolioOrchestrationService.selectForExecution(tier1, market);
        if (oppOpt.isEmpty()) {
            portfolioOrchestrationService.refresh(tier1, market);
            return;
        }

        LiveTraderDtos.RankedOpportunityDto opp = oppOpt.get();
        if (bearishOperationalService.blocksAutoExecution(opp)) {
            log.debug("Auto paper blocked by bearish operational intelligence: {}", opp.symbol());
            decisionTraceService.traceAutoEntryBlocked(opp, "Bearish long suppression / conflict");
            return;
        }
        if (!executionIntelligence.allowsAutoEntry(opp)) {
            String block = executionIntelligence.autoEntryBlockReason(opp);
            log.debug("Auto paper blocked by entry intelligence: {}", block);
            decisionTraceService.traceAutoEntryBlocked(opp, block != null ? block : "Intelligence gate");
            return;
        }
        Instant last = lastProbeBySymbol.get(opp.symbol());
        if (last != null && Instant.now().isBefore(last.plusSeconds(1800))) return;

        safetyService.recordProbeAttempt();
        int qualityScore = qualityToScore(opp.executionQuality());
        PaperExecutionRecord record = researchService.submitProbe(new PaperProbeRequest(
                opp.symbol(),
                opp.regime(),
                "AUTO_PAPER_ORCHESTRATED",
                null,
                opp.conviction(),
                opp.dominanceScore(),
                qualityScore
        ), opp);

        if (record.getStatus() != PaperExecutionStatus.BLOCKED
                && record.getStatus() != PaperExecutionStatus.REJECTED) {
            if (!record.getSimulatedFill()) {
                telemetryService.captureEntry(record, opp, "AUTO_PAPER_ORCHESTRATED");
            }
            decisionTraceService.traceEntry(record, opp, 0, "AUTO_PAPER_ORCHESTRATED");
            lastProbeBySymbol.put(opp.symbol(), Instant.now());
            log.info("Orchestrated paper probe {} regime={} C={} D={}",
                    opp.symbol(), opp.regime(), opp.conviction(), opp.dominanceScore());
        }
    }

    private static int qualityToScore(String quality) {
        if (quality == null) return 50;
        return switch (quality) {
            case "INSTITUTIONAL" -> 90;
            case "HIGH" -> 75;
            case "MEDIUM" -> 55;
            default -> 30;
        };
    }
}
