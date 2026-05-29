package com.tradingbot.execution.paperintelligence.quality;

import com.tradingbot.execution.paperintelligence.ExecutionQualityGrade;

public record ExecutionQualityScore(
        ExecutionQualityGrade entryQuality,
        ExecutionQualityGrade fillQuality,
        ExecutionQualityGrade trailingQuality,
        ExecutionQualityGrade exitQuality,
        ExecutionQualityGrade continuationCapture,
        int compositeScore,
        String summary
) {}
