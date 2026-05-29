package com.tradingbot.livetrader.execution;

import com.tradingbot.marketstructure.MarketStructureEngine;
import com.tradingbot.reliability.RegimeReliabilityLearningEngine;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Phase 188 — live regime reliability from closed paper telemetry (lightweight learning).
 */
@Component
@RequiredArgsConstructor
public class RegimeReliabilityEngine {

    private final RegimeReliabilityLearningEngine learningEngine;
    private final MarketStructureEngine marketStructureEngine;

    public int reliabilityBoost(String regime) {
        if (regime == null || regime.isBlank()) return 0;
        return learningEngine.rankingModifier(
                regime,
                marketStructureEngine.current(),
                1.5,
                "SESSION"
        );
    }

    public RegimeStats statsFor(String regime) {
        var p = learningEngine.profileFor(regime);
        RegimeStats s = new RegimeStats();
        s.closed = p.sampleSize();
        s.winRate = p.winRate();
        s.avgR = p.avgR();
        s.wins = (int) Math.round(p.winRate() * p.sampleSize());
        return s;
    }

    private static String normalize(String regime) {
        return regime.toUpperCase(Locale.US).trim();
    }

    public static final class RegimeStats {
        public int closed;
        public int wins;
        public double winRate;
        public double avgR;

        static RegimeStats empty() {
            return new RegimeStats();
        }
    }
}
