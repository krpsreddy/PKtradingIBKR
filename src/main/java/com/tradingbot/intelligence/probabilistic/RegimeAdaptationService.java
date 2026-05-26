package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.RegimeAdaptationDto;
import com.tradingbot.intelligence.historical.SetupStatisticsService;
import org.springframework.stereotype.Service;

@Service
public class RegimeAdaptationService {

    public RegimeAdaptationDto adapt(String setupType, String regime) {
        String setup = SetupStatisticsService.normalize(setupType);
        String r = regime != null ? regime : "TRENDING_BULL";
        int adjustment = 0;
        String message;

        if (setup.contains("CONT")) {
            if ("TRENDING_BULL".equals(r)) {
                adjustment = 15;
                message = "CONT excellent in TRENDING_BULL — boost confidence";
            } else if ("CHOPPY".equals(r)) {
                adjustment = -20;
                message = "CONT terrible in CHOPPY — reduce trust";
            } else {
                message = "CONT neutral in " + r;
            }
        } else if (setup.contains("OPEN_MOM") || setup.contains("OPEN")) {
            if ("CHOPPY".equals(r)) {
                adjustment = -18;
                message = "CHOPPY: reduce OPEN_MOM trust";
            } else if ("TRENDING_BULL".equals(r)) {
                adjustment = 12;
                message = "TRENDING_BULL: OPEN_MOM favored";
            } else {
                message = "OPEN momentum context: " + r;
            }
        } else if (setup.contains("FAIL")) {
            if ("TRENDING_BEAR".equals(r) || "CHOPPY".equals(r)) {
                adjustment = 14;
                message = "OPEN_FAIL best in weak breadth / bearish chop";
            } else {
                adjustment = -10;
                message = "OPEN_FAIL risky in bull regime";
            }
        } else if (setup.contains("VWAP")) {
            adjustment = "RISK_ON".equals(r) ? 8 : -5;
            message = "VWAP reclaim strong after 10AM in RISK_ON";
        } else {
            message = "Regime " + r + " — monitor alignment";
        }

        return RegimeAdaptationDto.builder()
                .regime(r)
                .setupType(setup)
                .confidenceAdjustment(adjustment)
                .message(message)
                .build();
    }
}
