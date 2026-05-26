package com.tradingbot.intelligence.historical;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.intelligence.AdaptiveRankingService;
import com.tradingbot.intelligence.historical.SetupStatisticsService;
import com.tradingbot.intelligence.historical.SessionFingerprintService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class HistoricalConfidenceService {

    private final AdaptiveRankingService adaptiveRankingService;
    private final SetupStatisticsService setupStatisticsService;
    private final SessionFingerprintService fingerprintService;
    private final TradingProperties tradingProperties;

    /**
     * Adjusts base confidence 0–100 using multi-day statistics, regime, and session fingerprint.
     */
    public int adjustConfidence(String signalType, String regime, String sector, int baseScore) {
        int score = adaptiveRankingService.adjustScore(signalType, regime, sector, baseScore);
        var stats = setupStatisticsService.statistics(signalType, tradingProperties.getIntelligenceLookbackDays());
        if (stats.getSampleSize() >= 5) {
            if (stats.getWinRate() >= 0.65) score += 6;
            else if (stats.getWinRate() <= 0.35) score -= 10;
            if (regime != null && regime.equals(stats.getBestRegime())) score += 4;
            if (regime != null && regime.equals(stats.getWorstRegime())) score -= 6;
        }
        var fp = fingerprintService.today();
        if ("chop heavy".equals(fp.getFingerprint()) && signalType != null
                && signalType.contains("OPEN_MOM")) {
            score -= 8;
        }
        if ("trend persistence".equals(fp.getFingerprint()) && signalType != null
                && signalType.contains("CONT")) {
            score += 5;
        }
        return Math.max(0, Math.min(100, score));
    }

    public double historicalWinRate(String signalType, String regime) {
        return adaptiveRankingService.winRate(signalType, regime);
    }
}
