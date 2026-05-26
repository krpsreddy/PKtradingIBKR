package com.tradingbot.intelligence.snapshot.dto;

import java.util.List;

/** Phase 164 — precomputed intelligence snapshot DTOs. */
public final class IntelligenceSnapshotDtos {

    private IntelligenceSnapshotDtos() {}

    public record IdealEntryZoneDto(double low, double high, String label) {}

    public record IntelligenceBarSnapshotDto(
            String symbol,
            String sessionDate,
            int barIndex,
            long timestamp,
            String regime,
            String classification,
            String triggerType,
            String traderAction,
            int continuationIntegrity,
            int expansionProbability,
            int exhaustionProbability,
            IdealEntryZoneDto entryZone,
            String chartZone,
            String markerText,
            String markerColor,
            String markerShape,
            String markerPosition,
            boolean addOpportunity,
            String triggerReason,
            String whyValid
    ) {}

    public record ReplayMarkerDto(
            long timestamp,
            String markerText,
            String markerColor,
            String shape,
            String position
    ) {}

    public record TimelineEventDto(
            long timestamp,
            String timeLabel,
            String eventType,
            String label,
            String detail,
            int triggerScore
    ) {}

    public record ExecutionCardDto(
            String symbol,
            String action,
            String entryType,
            String continuationIntegrity,
            String rvolLabel,
            String shallowPbQuality,
            String vwapPersistenceLabel,
            int expansionProbability,
            IdealEntryZoneDto idealEntryZone,
            String continuationRisk,
            String triggerReason,
            String windowLabel
    ) {}

    public record LiveRegimeSnapshotDto(
            boolean advisoryOnly,
            int lookbackDays,
            long generatedAt,
            int analyticsVersion,
            int sampleCount,
            List<ActiveRegimeRowDto> activeContinuationRegimes,
            List<ParticipationOpportunityDto> participationOpportunities,
            List<String> summaryInsights
    ) {}

    public record ActiveRegimeRowDto(
            String symbol,
            String regimeType,
            String classification,
            int expansionProbability,
            int continuationPersistenceScore,
            Integer sessionTimeMinutes
    ) {}

    public record ParticipationOpportunityDto(
            String symbol,
            String classification,
            int expansionProbability,
            int shallowPullbackQuality,
            String windowLabel,
            String advisoryNote
    ) {}

    public record ExecutionCardsSnapshotDto(
            boolean advisoryOnly,
            long generatedAt,
            int analyticsVersion,
            String symbol,
            List<ExecutionCardDto> cards,
            List<String> summaryInsights
    ) {}

    public record ReplayTriggerSnapshotDto(
            boolean advisoryOnly,
            long generatedAt,
            int analyticsVersion,
            String symbol,
            String sessionDate,
            List<IntelligenceBarSnapshotDto> triggers,
            List<ReplayMarkerDto> replayMarkers,
            List<TimelineEventDto> timelineEvents,
            List<String> summaryInsights
    ) {}

    public record ReplayTimelineSnapshotDto(
            boolean advisoryOnly,
            long generatedAt,
            int analyticsVersion,
            String symbol,
            String sessionDate,
            List<IntelligenceBarSnapshotDto> bars,
            List<ReplayMarkerDto> replayMarkers,
            List<TimelineEventDto> timelineEvents,
            VisualizationPayloadDto visualizationPayload
    ) {}

    public record VisualizationPayloadDto(
            int triggerCount,
            int addOpportunityCount,
            int exhaustionCount,
            String dominantRegime
    ) {}

    /** Phase 165 — autonomous regime scanner batch snapshot. */
    public record ScannerOpportunityDto(
            String symbol,
            String opportunityType,
            String action,
            String tone,
            String badge,
            int convictionScore,
            int expansionProbability,
            int continuationPersistence,
            int triggerIntegrity,
            int institutionalPressure,
            int exhaustionProbability,
            int executionQuality,
            String entryZoneLabel,
            String riskLabel,
            List<String> whyNow,
            String windowLabel,
            String rvolLabel
    ) {}

    public record ScannerSnapshotDto(
            boolean advisoryOnly,
            long generatedAt,
            List<String> symbols,
            List<ScannerOpportunityDto> opportunities,
            List<String> summaryInsights
    ) {}
}
