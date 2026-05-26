package com.tradingbot.intelligence;

import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.ExtendedStateDto;
import com.tradingbot.intelligence.dto.MarketRegimeDto;
import com.tradingbot.intelligence.dto.MultiTimeframeDto;
import com.tradingbot.intelligence.dto.SignalFreshnessDto;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OptionsAwareAlertFormatter {

    private final MultiTimeframeAnalysisService multiTimeframeAnalysisService;
    private final ExtendedConditionService extendedConditionService;
    private final MarketRegimeService marketRegimeService;
    private final SignalFreshnessService signalFreshnessService;

    public String formatFooter(String symbol, IndicatorResult indicators, LocalDateTime signalTime) {
        MultiTimeframeDto mtf = multiTimeframeAnalysisService.analyze(symbol);
        ExtendedStateDto extended = extendedConditionService.evaluate(
                indicators, indicators != null ? indicators.getRecentCandles() : List.of());
        MarketRegimeDto regime = marketRegimeService.getRegime();
        SignalFreshnessDto freshness = signalFreshnessService.evaluate(
                signalTime != null ? signalTime : MarketTime.nowLocal());

        String freshnessLabel = freshness.getAgeMinutes() <= 0 ? "NEW" : freshness.getFreshness();
        return """
                
                MTF: %s
                Freshness: %s
                Market: %s
                EXT: %s
                """.formatted(
                mtf.getSummary(),
                freshnessLabel,
                regime.getRegime(),
                extended.isExtended() ? "YES" : "NO"
        ).trim();
    }

    public List<String> warnings(String symbol, IndicatorResult indicators, LocalDateTime signalTime) {
        List<String> out = new ArrayList<>();
        ExtendedStateDto extended = extendedConditionService.evaluate(
                indicators, indicators != null ? indicators.getRecentCandles() : List.of());
        MarketRegimeDto regime = marketRegimeService.getRegime();
        SignalFreshnessDto freshness = signalFreshnessService.evaluate(signalTime);

        if (extended.isExtended() && extended.getOptionsWarning() != null) {
            out.add(extended.getOptionsWarning());
        }
        if (freshness.isStaleForOptions()) {
            out.add("Signal stale for options");
        }
        if (regime.isChoppy()) {
            out.add("High chop risk for options");
        }
        if ("LOW_MOMENTUM".equals(regime.getRegime()) || "RISK_OFF".equals(regime.getRegime())) {
            out.add("Weak market regime");
        }
        return out;
    }
}
