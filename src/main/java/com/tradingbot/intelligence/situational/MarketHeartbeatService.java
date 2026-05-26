package com.tradingbot.intelligence.situational;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.MarketHeartbeatDto;
import com.tradingbot.intelligence.BehaviorAnalyticsService;
import com.tradingbot.intelligence.options.MarketEmotionService;
import com.tradingbot.intelligence.MarketMemoryService;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.services.MarketTrendService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MarketHeartbeatService {

    private final MarketTrendService marketTrendService;
    private final MarketMemoryService marketMemoryService;
    private final BehaviorAnalyticsService behaviorAnalyticsService;
    private final MarketEmotionService marketEmotionService;
    private final TradingProperties tradingProperties;

    public MarketHeartbeatDto heartbeat() {
        MarketTrendDto trend = marketTrendService.getMarketTrend();
        MarketMemoryDto memory = marketMemoryService.expandedMemory(tradingProperties.getIntelligenceLookbackDays());
        List<String> pulses = new ArrayList<>();

        if (trend != null) {
            if (trend.isChoppy()) {
                pulses.add("Choppy environment intensifying");
            } else if ("TRENDING_BULL".equals(trend.getRegime())) {
                pulses.add("Trend persistence rising");
            } else if ("TRENDING_BEAR".equals(trend.getRegime())) {
                pulses.add("Bearish trend pressure");
            }
            if ("STRONG".equalsIgnoreCase(String.valueOf(trend.getSemiBreadth()))) {
                pulses.add("Semis breadth expanding");
            } else if (trend.getSemiBreadth() != null && trend.getSemiBreadth().toLowerCase().contains("weak")) {
                pulses.add("Semis leadership weakening");
            }
            if ("STRONG".equalsIgnoreCase(String.valueOf(trend.getAiBreadth()))) {
                pulses.add("AI leadership strong");
            } else if (trend.getAiBreadth() != null && trend.getAiBreadth().toLowerCase().contains("weak")) {
                pulses.add("AI leadership weakening");
            }
            if (trend.getSpyPersistence() != null && trend.getSpyPersistence() > 0.6) {
                pulses.add("SPY follow-through improving");
            }
        }

        if (memory != null) {
            Double cont = memory.getContinuationSuccessRate();
            if (cont != null && cont >= 0.6) {
                pulses.add("Continuation quality improving");
            } else if (cont != null && cont < 0.4) {
                pulses.add("Momentum deteriorating");
            }
            Double open = memory.getOpenMomentumSuccessRate();
            if (open != null && open < 0.4) {
                pulses.add("Opening momentum failing today");
            } else if (open != null && open >= 0.55) {
                pulses.add("Breakouts improving");
            }
            if (memory.getFakeBreakoutFrequency() != null && memory.getFakeBreakoutFrequency() > 0.45) {
                pulses.add("Fake breakout risk elevated");
            }
        }

        behaviorAnalyticsService.todayInsights().stream()
                .limit(2)
                .forEach(i -> pulses.add(i.getTitle().replace("⚠ ", "")));

        if (pulses.isEmpty()) {
            pulses.add("Monitoring session rhythm");
            pulses.add("Awaiting catalyst");
        }

        var emotion = marketEmotionService.assess(trend, memory);
        if (emotion != null && emotion.label() != null) {
            pulses.add(0, "Emotion: " + emotion.label());
        }

        return MarketHeartbeatDto.builder()
                .pulses(pulses.stream().distinct().limit(8).toList())
                .marketEmotion(emotion != null ? com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.MarketEmotionDto.builder()
                        .label(emotion.label())
                        .description(emotion.description())
                        .build() : null)
                .timestamp(System.currentTimeMillis())
                .build();
    }
}
