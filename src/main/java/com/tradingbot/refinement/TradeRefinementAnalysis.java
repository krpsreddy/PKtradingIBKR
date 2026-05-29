package com.tradingbot.refinement;

public record TradeRefinementAnalysis(
        double continuationCaptureEfficiency,
        boolean entryWasIdeal,
        boolean exitPremature,
        boolean secondLegSurvived,
        boolean marketStructureFavorable,
        boolean persistenceValid,
        String summary,
        String learningNote
) {}
