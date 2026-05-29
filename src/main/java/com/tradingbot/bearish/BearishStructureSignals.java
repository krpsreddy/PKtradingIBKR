package com.tradingbot.bearish;

import com.tradingbot.bearishassist.BearishBiasState;
import com.tradingbot.marketstructure.MarketStructureAssessment;

import java.util.List;

/** Phase 209 — computed downside pressure metrics for one symbol. */
public record BearishStructureSignals(
        int reclaimFailureScore,
        int rejectionPersistence,
        int breakdownAcceleration,
        int distributionPersistence,
        double downsideRvol,
        int squeezeRiskScore,
        boolean failedReclaim,
        boolean vwapRejected,
        boolean vwapAcceptanceLost,
        BearishBiasState bearishState,
        String bearishRegime,
        MarketStructureAssessment market,
        List<String> notes
) {}
