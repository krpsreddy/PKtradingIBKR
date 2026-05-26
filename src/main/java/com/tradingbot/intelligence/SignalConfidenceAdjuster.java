package com.tradingbot.intelligence;

import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.ExtendedStateDto;
import com.tradingbot.intelligence.dto.MarketRegimeDto;
import com.tradingbot.intelligence.dto.MultiTimeframeDto;
import com.tradingbot.signals.OpenMomentumSignalService;
import com.tradingbot.signals.SignalEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SignalConfidenceAdjuster {

    private final MultiTimeframeAnalysisService multiTimeframeAnalysisService;
    private final ExtendedConditionService extendedConditionService;
    private final MarketRegimeService marketRegimeService;

    public int adjustBuyConfidence(String symbol, String signalType, int baseScore, IndicatorResult indicators) {
        if (baseScore <= 0 || indicators == null || !indicators.isValid()) {
            return baseScore;
        }
        MultiTimeframeDto mtf = multiTimeframeAnalysisService.analyze(symbol);
        ExtendedStateDto extended = extendedConditionService.evaluate(indicators, indicators.getRecentCandles());
        MarketRegimeDto regime = marketRegimeService.getRegime();

        int adjusted = baseScore;

        if (mtf.isAlignedBullish()) {
            adjusted += 1;
        } else if (mtf.isAlignedBearish()) {
            adjusted -= 2;
        } else if ("bearish".equals(mtf.getTrend15m()) || "bearish".equals(mtf.getTrend1h())) {
            adjusted -= 1;
        }

        if (extended.isExtended()) {
            adjusted -= 2;
        }

        if ("CHOPPY".equals(regime.getRegime()) || "LOW_MOMENTUM".equals(regime.getRegime())) {
            if (isMomentumBuy(signalType)) {
                adjusted -= 2;
            }
        } else if ("TRENDING_BULL".equals(regime.getRegime()) || "RISK_ON".equals(regime.getRegime())) {
            if (OpenMomentumSignalService.OPEN_MOM_BUY.equals(signalType)
                    || SignalEngineService.CONT_BUY.equals(signalType)) {
                adjusted += 1;
            }
        }

        return Math.max(0, Math.min(8, adjusted));
    }

    private boolean isMomentumBuy(String signalType) {
        return OpenMomentumSignalService.OPEN_MOM_BUY.equals(signalType)
                || SignalEngineService.MOM_BUY.equals(signalType)
                || SignalEngineService.CONT_BUY.equals(signalType);
    }
}
