package com.tradingbot.intelligence.options;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import org.springframework.stereotype.Service;

@Service
public class MarketEmotionService {

    public record MarketEmotion(String label, String description) {}

    public MarketEmotion assess(MarketTrendDto trend, MarketMemoryDto memory) {
        if (trend == null) {
            return new MarketEmotion("indecisive", "Market indecisive");
        }
        boolean choppy = trend.isChoppy();
        Double cont = memory != null ? memory.getContinuationSuccessRate() : null;
        Double fake = memory != null ? memory.getFakeBreakoutFrequency() : null;

        if (choppy && fake != null && fake > 0.5) {
            return new MarketEmotion("trapped", "Trapped — chop with fake breakouts");
        }
        if ("TRENDING_BULL".equals(trend.getRegime()) && cont != null && cont >= 0.65) {
            return new MarketEmotion("euphoric", "Euphoric momentum — manage extension");
        }
        if ("TRENDING_BEAR".equals(trend.getRegime())) {
            return new MarketEmotion("panic", "Bearish pressure");
        }
        if (choppy) {
            return new MarketEmotion("indecisive", "Indecisive — range-bound");
        }
        if (cont != null && cont >= 0.55) {
            return new MarketEmotion("trend confidence", "Trend confidence intact");
        }
        return new MarketEmotion("grinding", "Grinding session — patience required");
    }

    public MarketEmotion assess(MarketTrendDto trend, MarketMemoryDto memory, OptionsIntelContext ctx) {
        if (ctx == null || trend == null) return assess(trend, memory);

        boolean choppy = trend.isChoppy();
        Double cont = memory != null ? memory.getContinuationSuccessRate() : null;
        Double fake = memory != null ? memory.getFakeBreakoutFrequency() : null;
        double failure = ctx.getFailure().getFailureProbability();

        if (choppy && fake != null && fake > 0.5) {
            return new MarketEmotion("trapped", "Trapped — chop with fake breakouts");
        }
        if ("TRENDING_BULL".equals(trend.getRegime()) && cont != null && cont >= 0.65 && ctx.getRvol() >= 2.5) {
            return new MarketEmotion("euphoric", "Euphoric momentum — manage extension");
        }
        if ("TRENDING_BEAR".equals(trend.getRegime()) && failure >= 45) {
            return new MarketEmotion("panic", "Panic selling pressure");
        }
        if (ctx.getDecay().getExhaustionProbability() >= 0.4) {
            return new MarketEmotion("exhaustion", "Momentum exhaustion building");
        }
        if (choppy) {
            return new MarketEmotion("indecisive", "Indecisive — range-bound");
        }
        if (cont != null && cont >= 0.55) {
            return new MarketEmotion("trend confidence", "Trend confidence intact");
        }
        if (ctx.getRvol() >= 2.0 && ctx.getSetupAgeMinutes() < 15) {
            return new MarketEmotion("impulsive", "Impulsive burst — verify follow-through");
        }
        return new MarketEmotion("grinding", "Grinding session — patience required");
    }
}
