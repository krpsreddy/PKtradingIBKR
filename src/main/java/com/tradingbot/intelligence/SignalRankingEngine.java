package com.tradingbot.intelligence;

import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.*;
import com.tradingbot.models.TradingSignal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SignalRankingEngine {

    private final MarketRegimeService marketRegimeService;
    private final AdaptiveRankingService adaptiveRankingService;

    public SignalRankDto rank(TradingSignal signal, IndicatorResult indicators,
                              MultiTimeframeDto mtf, ExtendedStateDto extended,
                              SignalFreshnessDto freshness, boolean bullishSignal) {
        List<String> boosters = new ArrayList<>();
        List<String> penalties = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        int score = 40;

        Integer conf = signal != null ? signal.getConfidenceScore() : null;
        if (conf != null) {
            score += Math.min(conf * 4, 24);
            boosters.add("Confidence " + conf);
        }

        double rvol = signal != null && signal.getRelativeVolume() != null
                ? signal.getRelativeVolume().doubleValue()
                : indicators != null && indicators.getRelativeVolume() != null
                ? indicators.getRelativeVolume().doubleValue() : 0;
        if (rvol >= 2.0) {
            score += 12;
            boosters.add("High RVOL");
        } else if (rvol >= 1.3) {
            score += 6;
            boosters.add("RVOL OK");
        } else if (rvol > 0 && rvol < 1.0) {
            score -= 8;
            penalties.add("Low volume");
        }

        if (freshness != null) {
            score += freshness.getFreshnessScore() / 5;
            if ("FRESH".equals(freshness.getFreshness())) {
                boosters.add("Fresh signal");
            }
            if (freshness.isStaleForOptions()) {
                score -= 15;
                penalties.add("Stale for options");
                warnings.add("Signal stale for options");
            }
        }

        if (mtf != null) {
            if (bullishSignal && mtf.isAlignedBullish()) {
                score += 12;
                boosters.add("MTF aligned bullish");
            } else if (!bullishSignal && mtf.isAlignedBearish()) {
                score += 12;
                boosters.add("MTF aligned bearish");
            } else if (bullishSignal && mtf.isAlignedBearish()) {
                score -= 15;
                penalties.add("Higher TF bearish");
            } else if (!bullishSignal && mtf.isAlignedBullish()) {
                score -= 15;
                penalties.add("Higher TF bullish");
            }
        }

        if (extended != null && extended.isExtended()) {
            score -= 18;
            penalties.add("Extended move");
            if (extended.getOptionsWarning() != null) {
                warnings.add(extended.getOptionsWarning());
            }
        }

        MarketRegimeDto regime = marketRegimeService.getRegime();
        if (bullishSignal) {
            if ("TRENDING_BULL".equals(regime.getRegime()) || "RISK_ON".equals(regime.getRegime())) {
                score += 10;
                boosters.add("Bull regime");
            } else if ("CHOPPY".equals(regime.getRegime())) {
                score -= 12;
                penalties.add("Choppy market");
                warnings.add("High chop risk for options");
            } else if ("TRENDING_BEAR".equals(regime.getRegime()) || "RISK_OFF".equals(regime.getRegime())) {
                score -= 10;
                penalties.add("Weak market regime");
            }
        } else {
            if ("TRENDING_BEAR".equals(regime.getRegime()) || "RISK_OFF".equals(regime.getRegime())) {
                score += 10;
                boosters.add("Bear regime");
            } else if ("CHOPPY".equals(regime.getRegime())) {
                score -= 10;
                penalties.add("Choppy market");
            }
        }

        if (indicators != null && indicators.isValid()) {
            BigDecimal body = indicators.getClose().subtract(indicators.getOpen()).abs();
            BigDecimal range = indicators.getHigh().subtract(indicators.getLow());
            if (range.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal bodyPct = body.divide(range, 2, java.math.RoundingMode.HALF_UP);
                if (bodyPct.compareTo(BigDecimal.valueOf(0.55)) >= 0) {
                    score += 5;
                    boosters.add("Clean breakout bar");
                }
            }
        }

        score = adaptiveRankingService.adjustScore(
                signal != null ? signal.getSignalType() : null,
                regime.getRegime(),
                signal != null ? signal.getSymbol() : null,
                score);

        score = Math.max(0, Math.min(100, score));
        return SignalRankDto.builder()
                .rankScore(score)
                .rank(0)
                .boosters(boosters)
                .penalties(penalties)
                .optionsWarnings(warnings)
                .build();
    }

    public static boolean isBullishSignalType(String signalType) {
        if (signalType == null) {
            return true;
        }
        return signalType.contains("BUY")
                || signalType.contains("UP")
                || "OPEN_SCOUT".equals(signalType);
    }
}
