package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.SessionPriorityDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SessionPriorityEngine {

    public SessionPriorityDto compute(MarketTrendDto trend, MarketMemoryDto memory) {
        if (trend == null) {
            return SessionPriorityDto.builder()
                    .insight("Awaiting market data — maintain selectivity")
                    .category("NEUTRAL")
                    .severity("low")
                    .detail("Market trend unavailable.")
                    .build();
        }

        if (memory != null && memory.getContinuationSuccessRate() != null
                && memory.getContinuationSuccessRate() >= 0.65
                && (memory.getOpenMomentumSuccessRate() == null
                || memory.getContinuationSuccessRate() > memory.getOpenMomentumSuccessRate())) {
            return SessionPriorityDto.builder()
                    .insight("Continuation setups strongest today")
                    .category("SETUP_FOCUS")
                    .severity("high")
                    .detail("CONT outperforming OPEN_MOM this session — prioritize pullbacks.")
                    .build();
        }

        if (memory != null && memory.getOpenMomentumSuccessRate() != null
                && memory.getOpenMomentumSuccessRate() < 0.35) {
            return SessionPriorityDto.builder()
                    .insight("Opening momentum failing today")
                    .category("AVOID")
                    .severity("high")
                    .detail("OPEN_MOM win rate below 35% — wait for confirmation or skip.")
                    .build();
        }

        if ("STRONG".equals(trend.getSemiBreadth()) && "STRONG".equals(trend.getAiBreadth())) {
            return SessionPriorityDto.builder()
                    .insight("Semiconductors leading market")
                    .category("SECTOR")
                    .severity("high")
                    .detail("Semi + AI breadth STRONG — favor leaders in these groups.")
                    .build();
        }

        if (trend.isChoppy()) {
            return SessionPriorityDto.builder()
                    .insight("Avoid EXTENDED breakouts")
                    .category("RISK")
                    .severity("medium")
                    .detail("CHOPPY regime — extended entries historically underperform.")
                    .build();
        }

        if (!trend.isRiskOn() && trend.getRiskOnScore() != null && trend.getRiskOnScore() < 40) {
            return SessionPriorityDto.builder()
                    .insight("Risk-off regime increasing")
                    .category("REGIME")
                    .severity("medium")
                    .detail("Risk-on score " + Math.round(trend.getRiskOnScore()) + " — reduce size.")
                    .build();
        }

        if (memory != null && !memory.getStrongestSetups().isEmpty()) {
            String top = memory.getStrongestSetups().get(0);
            return SessionPriorityDto.builder()
                    .insight("Lean into " + top + " today")
                    .category("SETUP_FOCUS")
                    .severity("medium")
                    .detail("Session memory shows strongest win rate in this setup type.")
                    .build();
        }

        return SessionPriorityDto.builder()
                .insight("Maintain selectivity — wait for A-quality")
                .category("PROCESS")
                .severity("low")
                .detail(trend.getRegimeSummary() != null ? trend.getRegimeSummary() : trend.getRegime())
                .build();
    }
}
