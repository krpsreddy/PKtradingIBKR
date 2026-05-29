package com.tradingbot.livetrader;

import com.tradingbot.api.dto.PaperExecutionDtos;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.MarketHeartbeatDto;
import com.tradingbot.intelligence.execution.realtime.RealTimeExecutionEngine;
import com.tradingbot.intelligence.execution.realtime.dto.RealTimeExecutionDtos.ExecutionFeedSnapshotDto;
import com.tradingbot.intelligence.live.LiveScannerService;
import com.tradingbot.intelligence.snapshot.dto.IntelligenceSnapshotDtos.ScannerSnapshotDto;
import com.tradingbot.intelligence.situational.MarketHeartbeatService;
import com.tradingbot.bearish.TopBearishOpportunitySelector;
import com.tradingbot.config.IBKRProperties;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.paper.*;
import com.tradingbot.services.TradingSymbolService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LiveTraderSnapshotService {

    private final RealTimeExecutionEngine executionEngine;
    private final LiveScannerService liveScannerService;
    private final TradingSymbolService tradingSymbolService;
    private final MarketHeartbeatService marketHeartbeatService;
    private final LiveTraderRankingService rankingService;
    private final LiveTraderRuntimeState runtimeState;
    private final PaperExecutionStateService paperExecutionStateService;
    private final PaperExecutionResearchService paperExecutionResearchService;
    private final IbkrGatewaySafetyService gatewaySafetyService;
    private final IBKRClientService ibkrClientService;
    private final IBKRProperties ibkrProperties;
    private final PaperExecutionAnalyticsService paperAnalyticsService;
    private final LiveTraderTelegramService telegramService;
    private final LiveTraderAutoExecutionHook autoExecutionHook;
    private final TopBearishOpportunitySelector topBearishSelector;

    public LiveTraderDtos.Tier1SnapshotDto tier1() {
        if (!runtimeState.isScanningEnabled()) {
            return emptyTier1();
        }
        liveScannerService.ensureFresh();
        ExecutionFeedSnapshotDto feed = executionEngine.snapshot();
        ScannerSnapshotDto scanner = liveScannerService.currentSnapshot();

        List<LiveTraderDtos.RankedOpportunityDto> ranked = rankingService.rank(feed.feed(), scanner.opportunities());
        if (ranked.isEmpty() && !scanner.opportunities().isEmpty()) {
            ranked = rankingService.rankLiveScanner(scanner.opportunities(), 8);
        }
        LiveTraderDtos.RankedOpportunityDto dominant = ranked.isEmpty() ? null : ranked.get(0);
        return new LiveTraderDtos.Tier1SnapshotDto(
                dominant,
                ranked,
                rankingService.degrading(ranked),
                System.currentTimeMillis(),
                feed.nanoScanGeneration()
        );
    }

    public LiveTraderDtos.LiveTraderSnapshotDto fullSnapshot() {
        LiveTraderDtos.Tier1SnapshotDto tier1 = tier1();
        PaperExecutionMode mode = runtimeState.getExecutionMode();
        if (runtimeState.isAutoExecutionEnabled() && mode == PaperExecutionMode.PAPER_RESEARCH) {
            autoExecutionHook.maybeExecute(tier1);
        }
        if (runtimeState.isTelegramEnabled() && runtimeState.isScanningEnabled()) {
            dispatchTelegram(tier1);
        }

        var active = paperExecutionResearchService.activeRecords().stream()
                .map(PaperExecutionDtos::toDto)
                .collect(Collectors.toList());
        var analytics = paperAnalyticsService.buildAnalytics();

        List<LiveTraderDtos.BearishOpportunityMobileDto> topBearish =
                topBearishSelector.selectTop(tier1.topRanked(), 5);

        return new LiveTraderDtos.LiveTraderSnapshotDto(
                tier1,
                marketHeartbeatService.heartbeat(),
                buildPaperStatus(mode),
                active,
                buildPnl(active, analytics),
                buildAdvisories(tier1),
                runtimeState.snapshot(),
                topBearish
        );
    }

    private PaperExecutionDtos.ExecutionStatusDto buildPaperStatus(PaperExecutionMode mode) {
        var safety = gatewaySafetyService.validate(mode);
        return PaperExecutionDtos.ExecutionStatusDto.builder()
                .mode(mode)
                .researchInfrastructureEnabled(paperExecutionStateService.isResearchInfrastructureEnabled())
                .gatewayMode(gatewaySafetyService.resolveGatewayMode())
                .configuredIbkrPort(ibkrProperties.getPort())
                .paperPort(ibkrProperties.getPaperPort())
                .livePort(ibkrProperties.getLivePort())
                .ibkrConnected(ibkrClientService.isConnected())
                .ibkrReadyForOrders(ibkrClientService.isReadyForOrders())
                .safety(PaperExecutionDtos.SafetyDto.builder()
                        .allowed(safety.allowed())
                        .reason(safety.reason())
                        .gateway(safety.gateway())
                        .build())
                .build();
    }

    private LiveTraderDtos.PnlSummaryDto buildPnl(
            List<PaperExecutionDtos.PaperExecutionRecordDto> active,
            PaperExecutionDtos.ExecutionAnalyticsDto analytics
    ) {
        BigDecimal unrealized = active.stream()
                .map(r -> r.getMfeR() != null ? r.getMfeR() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new LiveTraderDtos.PnlSummaryDto(
                unrealized.setScale(4, RoundingMode.HALF_UP),
                analytics.getAvgRealizedR() != null ? analytics.getAvgRealizedR() : BigDecimal.ZERO,
                analytics.getOpenCount(),
                analytics.getClosedCount(),
                analytics.getAvgRealizedR(),
                analytics.getByRegime() != null ? analytics.getByRegime().values().stream()
                        .mapToInt(r -> r.getContinuationSurvivalCount()).sum() : 0
        );
    }

    private List<String> buildAdvisories(LiveTraderDtos.Tier1SnapshotDto tier1) {
        List<String> out = new ArrayList<>();
        if (tier1.dominant() == null) {
            out.add("No dominant opportunity — scanning idle feed");
            return out;
        }
        var d = tier1.dominant();
        if (d.degrading()) out.add("EXIT_WARNING: " + d.symbol() + " weakening");
        else if (d.emergingFast()) out.add("SECOND_LEG_ACTIVE: " + d.symbol());
        else if (d.persistenceSeconds() > 120) out.add("HOLD_PERSISTENCE: " + d.symbol());
        return out;
    }

    private void dispatchTelegram(LiveTraderDtos.Tier1SnapshotDto tier1) {
        if (tier1.dominant() != null) {
            telegramService.maybeAlert("DOMINANT_NOW", tier1.dominant(), 70);
            if (tier1.dominant().institutionalPressure() >= 65) {
                telegramService.maybeAlert("INSTITUTIONAL_FLOW", tier1.dominant(), 60);
            }
            if (tier1.dominant().emergingFast()) {
                telegramService.maybeAlert("EMERGING_FAST", tier1.dominant(), 55);
            }
        }
        for (var d : tier1.degrading()) {
            telegramService.maybeAlert("EXHAUSTION_RISK", d, 50);
        }
    }

    /** Mobile scanner tab — realtime rankings only (Phase 187). */
    public LiveTraderDtos.Tier1SnapshotDto liveScanTier1(int limit) {
        if (!runtimeState.isScanningEnabled()) {
            return emptyTier1();
        }
        liveScannerService.ensureFresh(2_000);
        ScannerSnapshotDto scanner = liveScannerService.currentSnapshot();
        List<LiveTraderDtos.RankedOpportunityDto> ranked =
                rankingService.rankLiveScanner(scanner.opportunities(), limit);
        LiveTraderDtos.RankedOpportunityDto dominant = ranked.isEmpty() ? null : ranked.get(0);
        return new LiveTraderDtos.Tier1SnapshotDto(
                dominant,
                ranked,
                rankingService.degrading(ranked),
                scanner.generatedAt(),
                liveScannerService.generation()
        );
    }

    private LiveTraderDtos.Tier1SnapshotDto emptyTier1() {
        return new LiveTraderDtos.Tier1SnapshotDto(null, List.of(), List.of(), System.currentTimeMillis(), 0);
    }

    public LiveTraderDtos.TelegramTickResultDto testTelegram(LiveTraderDtos.RankedOpportunityDto dominant) {
        return telegramService.maybeAlert("DOMINANT_NOW", dominant, 0);
    }
}
