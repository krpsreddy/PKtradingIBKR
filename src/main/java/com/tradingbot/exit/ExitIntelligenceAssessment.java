package com.tradingbot.exit;

public record ExitIntelligenceAssessment(
        ExitState state,
        boolean shouldClose,
        String reason,
        double suggestedTrailR
) {}
