package com.tradingbot.livetrader;

import com.tradingbot.api.dto.PaperExecutionDtos;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.MarketHeartbeatDto;
import com.tradingbot.intelligence.execution.realtime.dto.RealTimeExecutionDtos.ExecutionFeedItemDto;
import com.tradingbot.bearishassist.BearishAssistMode;
import com.tradingbot.paper.PaperExecutionMode;

import java.math.BigDecimal;
import java.util.List;

public final class LiveTraderDtos {

    private LiveTraderDtos() {}

    public record RuntimeControlsDto(
            boolean scanningEnabled,
            boolean telegramEnabled,
            boolean autoExecutionEnabled,
            PaperExecutionMode executionMode,
            BearishAssistMode bearishAssistMode,
            boolean backgroundHydrationEnabled,
            int backgroundHydrationPending,
            boolean killSwitchActive
    ) {}

    public record KillSwitchResultDto(
            boolean active,
            int positionsFlattened,
            String message
    ) {}

    public record TelemetryLogDto(
            String symbol,
            String regime,
            String executionQuality,
            String entryReason,
            String exitReason,
            Double realizedR,
            long timestamp
    ) {}

    public record OperationalMonitorDto(
            boolean ibkrConnected,
            boolean ibkrReady,
            boolean ibkrStreaming,
            String quoteFreshness,
            boolean scannerEnabled,
            boolean autoExecutionEnabled,
            boolean killSwitchActive,
            int scannerGeneration,
            long scannerAgeMs,
            int telemetryLogCount,
            int openPaperPositions,
            String executionMode,
            Long brokerLatencyMs,
            String dataIntegrityState,
            int dataIntegrityScore,
            boolean executionBlockedByData,
            List<TelemetryLogDto> recentTelemetry,
            List<String> safetyMessages,
            int verifiedActiveStreams,
            int registrySubscriptions,
            int staleStreamCount,
            int deadStreamCount,
            long reconnectAttempts,
            long avgTickLatencyMs,
            long lastSuccessfulTickMs,
            int streamHealthScore,
            String ibkrPhase
    ) {
        public OperationalMonitorDto(
                boolean ibkrConnected,
                boolean ibkrReady,
                boolean ibkrStreaming,
                String quoteFreshness,
                boolean scannerEnabled,
                boolean autoExecutionEnabled,
                boolean killSwitchActive,
                int scannerGeneration,
                long scannerAgeMs,
                int telemetryLogCount,
                int openPaperPositions,
                String executionMode,
                Long brokerLatencyMs,
                String dataIntegrityState,
                int dataIntegrityScore,
                boolean executionBlockedByData,
                List<TelemetryLogDto> recentTelemetry,
                List<String> safetyMessages
        ) {
            this(ibkrConnected, ibkrReady, ibkrStreaming, quoteFreshness, scannerEnabled, autoExecutionEnabled,
                    killSwitchActive, scannerGeneration, scannerAgeMs, telemetryLogCount, openPaperPositions,
                    executionMode, brokerLatencyMs, dataIntegrityState, dataIntegrityScore, executionBlockedByData,
                    recentTelemetry, safetyMessages, 0, 0, 0, 0, 0, -1, 0, 0, "DISCONNECTED");
        }
    }

    public record SetRuntimeControlsRequest(
            Boolean scanningEnabled,
            Boolean telegramEnabled,
            Boolean autoExecutionEnabled,
            PaperExecutionMode executionMode,
            BearishAssistMode bearishAssistMode,
            Boolean backgroundHydrationEnabled
    ) {}

    /** Phase 209 — bearish operational intelligence overlay (live execution). */
    public record BearishOperationalOverlayDto(
            String longSuppression,
            String deterioration,
            String directionalConflict,
            String bearishEnvironment,
            String putAssistGrade,
            int bearishBias,
            String bearishLifecycle,
            boolean putAssistActive,
            String operationalChip,
            String premarketChip,
            List<String> notes
    ) {}

    /** Phase 202 — discretionary PUT assist advisory (no auto short). */
    public record PutAssistAdvisoryDto(
            boolean active,
            int bearishBias,
            String bearishState,
            String breakdownProbability,
            String confidence,
            List<String> reasons,
            List<String> blockReasons,
            String narrative,
            String badgeLabel,
            String putAssistGrade
    ) {}

    public record RankedOpportunityDto(
            String symbol,
            String regime,
            String action,
            String tone,
            String badge,
            String maturityState,
            int conviction,
            int convictionVelocity,
            int persistenceSeconds,
            int institutionalPressure,
            int expansionProbability,
            int dominanceScore,
            List<String> whyNow,
            String entryZoneLabel,
            String riskLabel,
            boolean emergingFast,
            boolean degrading,
            long updatedAt,
            String executionQuality,
            String tradeLifecycle,
            String velocityTrend,
            double rvol,
            String stopLabel,
            String targetLabel,
            String projectedR,
            String dataFreshness,
            int reliabilityBoost,
            boolean marketAligned,
            long lastTickMs,
            PutAssistAdvisoryDto putAssist,
            BearishOperationalOverlayDto bearishOps
    ) {
        public RankedOpportunityDto withPutAssist(PutAssistAdvisoryDto assist) {
            return new RankedOpportunityDto(
                    symbol, regime, action, tone, badge, maturityState,
                    conviction, convictionVelocity, persistenceSeconds,
                    institutionalPressure, expansionProbability, dominanceScore,
                    whyNow, entryZoneLabel, riskLabel, emergingFast, degrading,
                    updatedAt, executionQuality, tradeLifecycle, velocityTrend,
                    rvol, stopLabel, targetLabel, projectedR, dataFreshness,
                    reliabilityBoost, marketAligned, lastTickMs, assist, bearishOps);
        }

        public RankedOpportunityDto withBearishOps(BearishOperationalOverlayDto ops) {
            return new RankedOpportunityDto(
                    symbol, regime, action, tone, badge, maturityState,
                    conviction, convictionVelocity, persistenceSeconds,
                    institutionalPressure, expansionProbability, dominanceScore,
                    whyNow, entryZoneLabel, riskLabel, emergingFast, degrading,
                    updatedAt, executionQuality, tradeLifecycle, velocityTrend,
                    rvol, stopLabel, targetLabel, projectedR, dataFreshness,
                    reliabilityBoost, marketAligned, lastTickMs, putAssist, ops);
        }
    }

    public record Tier1SnapshotDto(
            RankedOpportunityDto dominant,
            List<RankedOpportunityDto> topRanked,
            List<RankedOpportunityDto> degrading,
            long generatedAt,
            int feedGeneration
    ) {}

    public record PnlSummaryDto(
            BigDecimal unrealizedSumR,
            BigDecimal realizedSumR,
            int openPositions,
            int closedToday,
            BigDecimal avgRealizedR,
            int continuationCaptures
    ) {}

    /** Phase 210 — mobile PUT assist row (snapshot payload). */
    public record BearishOpportunityMobileDto(
            String symbol,
            String bearishRegime,
            String breakdownQuality,
            int bearishBias,
            int persistenceSeconds,
            int breakdownProbability,
            int squeezeRisk,
            String putGrade,
            String narrative
    ) {}

    public record LiveTraderSnapshotDto(
            Tier1SnapshotDto tier1,
            MarketHeartbeatDto market,
            PaperExecutionDtos.ExecutionStatusDto paperStatus,
            List<PaperExecutionDtos.PaperExecutionRecordDto> activePositions,
            PnlSummaryDto pnl,
            List<String> advisories,
            RuntimeControlsDto runtime,
            List<BearishOpportunityMobileDto> topBearishOpportunities
    ) {}

    public record TelegramTickResultDto(
            boolean sent,
            String alertType,
            String symbol,
            String reason
    ) {}

    public record PortfolioOpportunitySlotDto(
            String symbol,
            String regime,
            String state,
            String reason,
            int dominance,
            int conviction,
            int persistence,
            String executionQuality,
            String lifecycle,
            long queuedAt
    ) {}

    public record ActivePortfolioSlotDto(
            String symbol,
            String regime,
            String sectorCluster,
            String lifecycle,
            int dominance,
            int conviction,
            String velocityTrend,
            java.math.BigDecimal unrealizedR,
            java.math.BigDecimal mfeR,
            java.math.BigDecimal maeR,
            Integer holdDurationSec,
            String state
    ) {}

    public record PortfolioStateDto(
            ActivePortfolioSlotDto activePosition,
            List<PortfolioOpportunitySlotDto> queued,
            List<PortfolioOpportunitySlotDto> suppressed,
            List<PortfolioOpportunitySlotDto> correlationBlocks,
            List<PortfolioOpportunitySlotDto> qualityRejected,
            List<PortfolioOpportunitySlotDto> marketRejected,
            List<PortfolioOpportunitySlotDto> replacementCandidates,
            int maxActivePositions,
            int queueSize,
            long updatedAt
    ) {}

    /** Phase 194 — dynamic IBKR stream allocation snapshot. */
    public record StreamSymbolDto(
            String symbol,
            String tier,
            String reason,
            int priorityScore,
            int dominanceScore,
            String lifecycle,
            boolean ibkrSubscribed,
            String tickHealth
    ) {
        public StreamSymbolDto(
                String symbol,
                String tier,
                String reason,
                int priorityScore,
                int dominanceScore,
                String lifecycle,
                boolean ibkrSubscribed
        ) {
            this(symbol, tier, reason, priorityScore, dominanceScore, lifecycle, ibkrSubscribed, "UNKNOWN");
        }
    }

    /** Phase 216 — tick-verified stream health (realtimeUsed = verified ticks only). */
    public record StreamStateDto(
            boolean dynamicEnabled,
            int realtimeUsed,
            int realtimeMax,
            int registrySubscriptions,
            List<StreamSymbolDto> realtime,
            List<StreamSymbolDto> snapshot,
            List<StreamSymbolDto> dormant,
            List<String> promotionQueue,
            List<String> demotionQueue,
            long lastReconcileMs,
            long lastSnapshotRefreshMs,
            List<String> staleStreams,
            List<String> deadStreams,
            long reconnectAttempts,
            long avgTickLatencyMs,
            long lastSuccessfulTickMs,
            int streamHealthScore,
            String ibkrPhase
    ) {}
}
