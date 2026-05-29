package com.tradingbot.marketstructure;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.intelligence.MarketMemoryService;
import com.tradingbot.sessionintelligence.PremarketIntelligenceService;
import com.tradingbot.services.MarketTrendService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Phase 196 — macro filter layer; reduces continuation confidence in hostile environments.
 */
@Service
@RequiredArgsConstructor
public class MarketStructureEngine {

    private final MarketTrendService marketTrendService;
    private final MarketMemoryService marketMemoryService;
    private final MarketStructureClassifier classifier;
    private final TradingProperties tradingProperties;
    private final PremarketIntelligenceService premarketIntelligenceService;

    private final AtomicReference<MarketStructureAssessment> cached = new AtomicReference<>();

    public MarketStructureAssessment assess() {
        MarketTrendDto trend = marketTrendService.getMarketTrend();
        MarketMemoryDto memory = marketMemoryService.expandedMemory(tradingProperties.getIntelligenceLookbackDays());
        MarketStructureAssessment a = classifier.classify(trend, memory);
        cached.set(a);
        return a;
    }

    public MarketStructureAssessment current() {
        MarketStructureAssessment a = cached.get();
        return a != null ? a : assess();
    }

    /** Apply structure modifier to live conviction (floor 0). */
    public int adjustConviction(int raw, String opportunityRegime) {
        return adjustConviction(raw, opportunityRegime, null);
    }

    /** Apply structure + optional symbol PM context (floor 0). */
    public int adjustConviction(int raw, String opportunityRegime, String symbol) {
        MarketStructureAssessment s = current();
        int pmMod = 0;
        if (symbol != null && premarketIntelligenceService.enabled()) {
            pmMod = premarketIntelligenceService.bullishModifier(symbol);
        }
        int adjusted = raw + s.continuationModifier() + pmMod;
        if (s.blockAggressiveBreakout() && isBreakoutRegime(opportunityRegime)) {
            adjusted -= 15;
        }
        if (s.boostContinuation() && isContinuationRegime(opportunityRegime)) {
            adjusted += 6;
        }
        return Math.max(0, Math.min(s.convictionCap(), adjusted));
    }

    public boolean allowsContinuationRegime(String regime) {
        if (regime == null) return true;
        MarketStructureAssessment s = current();
        String r = regime.toUpperCase(Locale.US);
        if (s.blockAggressiveBreakout() && (r.contains("BREAKOUT") || r.contains("OPEN_MOM"))) {
            return false;
        }
        if (s.tags().contains(MarketEnvironmentState.CHOP)
                && s.tags().contains(MarketEnvironmentState.LOW_PARTICIPATION)
                && r.contains("CONTINUATION")) {
            return false;
        }
        return true;
    }

    private static boolean isBreakoutRegime(String regime) {
        if (regime == null) return false;
        String r = regime.toUpperCase(Locale.US);
        return r.contains("BREAKOUT") || r.contains("OPEN_MOM") || r.contains("EXPANSION");
    }

    private static boolean isContinuationRegime(String regime) {
        if (regime == null) return false;
        String r = regime.toUpperCase(Locale.US);
        return r.contains("CONTINUATION") || r.contains("PULLBACK") || r.contains("TREND");
    }
}
