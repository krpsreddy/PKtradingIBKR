package com.tradingbot.api.dto.cognition;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class CognitionSnapshotDto {
    CognitionPartDtos.SetupNarrativeDto setupNarrative;
    CognitionPartDtos.SessionPriorityDto sessionPriority;
    CognitionPartDtos.SessionTemperatureDto sessionTemperature;
    List<CognitionPartDtos.CoachingFeedItemDto> coachingFeed;
    CognitionPartDtos.MarketPersonalityDto marketPersonality;
    CognitionPartDtos.PremarketBriefDto premarket;
    CognitionPartDtos.PersonalizedCoachingDto personalized;
    CognitionPartDtos.TraderDisciplineDto discipline;
    List<CognitionPartDtos.IntelligenceEventDto> events;
    CognitionPartDtos.MarketMemoryNarrativeDto memoryNarrative;
    CognitionPartDtos.ProbabilisticGuidanceDto probabilisticGuidance;
    CognitionPartDtos.IntelligenceSummaryDto summary;
    CognitionPartDtos.AiSessionReviewDto aiSessionReview;
    CognitionPartDtos.PerformanceHeatmapDto heatmap;
    CognitionPartDtos.VisualEmphasisDto visualEmphasis;
    long timestamp;
}
