package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.MarketTrustDto;
import com.tradingbot.api.dto.MarketTrendDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MarketTrustScoreService {

    public MarketTrustDto score(MarketTrendDto trend, MarketMemoryDto memory) {
        int trust = 55;
        List<String> factors = new ArrayList<>();

        if (trend != null) {
            String regime = trend.getRegime();
            if ("TRENDING_BULL".equals(regime) || "TRENDING_BEAR".equals(regime)) {
                trust += 12;
                factors.add("Clear regime: " + regime);
            } else if ("CHOPPY".equals(regime)) {
                trust -= 15;
                factors.add("Choppy regime reduces signal reliability");
            }
        }

        if (memory != null) {
            Double fake = memory.getFakeBreakoutFrequency();
            if (fake != null && fake > 0.5) {
                trust -= 12;
                factors.add("High fake breakout frequency");
            } else if (fake != null && fake < 0.3) {
                trust += 8;
                factors.add("Breakouts following through");
            }
            Double cont = memory.getContinuationSuccessRate();
            if (cont != null && cont >= 0.6) {
                trust += 10;
                factors.add("Continuation setups reliable");
            } else if (cont != null && cont < 0.4) {
                trust -= 8;
                factors.add("Continuation underperforming");
            }
            if (memory.getStrongestSetups() != null && !memory.getStrongestSetups().isEmpty()) {
                factors.add("Strong setups: " + String.join(", ", memory.getStrongestSetups().stream().limit(2).toList()));
            }
        }

        trust = Math.max(0, Math.min(100, trust));
        String label = trust >= 70 ? "HIGH TRUST" : trust >= 45 ? "MODERATE" : "LOW TRUST";

        return MarketTrustDto.builder()
                .score(trust)
                .label(label)
                .factors(factors)
                .build();
    }
}
