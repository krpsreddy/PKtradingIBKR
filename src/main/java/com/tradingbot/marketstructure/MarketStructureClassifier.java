package com.tradingbot.marketstructure;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.intelligence.live.MarketSessionClock;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Phase 196 — classifies session macro structure from index trend + breadth. */
@Component
public class MarketStructureClassifier {

    private final MarketSessionClock sessionClock;

    public MarketStructureClassifier(MarketSessionClock sessionClock) {
        this.sessionClock = sessionClock;
    }

    public MarketStructureAssessment classify(MarketTrendDto trend, MarketMemoryDto memory) {
        List<MarketEnvironmentState> tags = new ArrayList<>();
        int sessionMin = sessionClock.sessionMinutesSinceRthOpen();
        String window = sessionClock.windowLabel(sessionMin);

        boolean choppy = trend != null && trend.isChoppy();
        boolean riskOn = trend != null && trend.isRiskOn();
        String spy = trend != null ? safe(trend.getSpyTrend()) : "neutral";
        String qqq = trend != null ? safe(trend.getQqqTrend()) : "neutral";
        double spyPersist = trend != null && trend.getSpyPersistence() != null ? trend.getSpyPersistence() : 0;
        String semi = trend != null ? safe(trend.getSemiBreadth()) : "";
        String ai = trend != null ? safe(trend.getAiBreadth()) : "";

        double fakeBreak = memory != null && memory.getFakeBreakoutFrequency() != null
                ? memory.getFakeBreakoutFrequency() : 0;
        double contRate = memory != null && memory.getContinuationSuccessRate() != null
                ? memory.getContinuationSuccessRate() : 0.5;

        MarketEnvironmentState primary = MarketEnvironmentState.MIDDAY_DRIFT;

        if ("OPENING".equals(window)) {
            primary = MarketEnvironmentState.OPENING_DRIVE;
            tags.add(MarketEnvironmentState.OPENING_DRIVE);
        } else if ("AFTERNOON".equals(window) && sessionMin >= 330) {
            primary = MarketEnvironmentState.POWER_HOUR;
            tags.add(MarketEnvironmentState.POWER_HOUR);
        } else if ("MIDDAY".equals(window)) {
            primary = MarketEnvironmentState.MIDDAY_DRIFT;
            tags.add(MarketEnvironmentState.MIDDAY_DRIFT);
        }

        if (choppy) {
            tags.add(MarketEnvironmentState.CHOP);
            if (primary == MarketEnvironmentState.MIDDAY_DRIFT || primary == MarketEnvironmentState.OPENING_DRIVE) {
                primary = MarketEnvironmentState.CHOP;
            }
        }

        if ("bullish".equals(spy) && "bullish".equals(qqq) && spyPersist >= 0.55 && riskOn) {
            tags.add(MarketEnvironmentState.TREND_DAY_BULL);
            if (!choppy) primary = MarketEnvironmentState.TREND_DAY_BULL;
        } else if ("bearish".equals(spy) && "bearish".equals(qqq)) {
            tags.add(MarketEnvironmentState.TREND_DAY_BEAR);
            if (!choppy) primary = MarketEnvironmentState.TREND_DAY_BEAR;
        }

        if (semi.contains("weak") && ai.contains("weak")) {
            tags.add(MarketEnvironmentState.LOW_PARTICIPATION);
        }
        if (contRate >= 0.58 && !choppy) {
            tags.add(MarketEnvironmentState.EXPANSION_ENV);
        }
        if (fakeBreak >= 0.42) {
            tags.add(MarketEnvironmentState.FAILED_BREAKOUT_ENV);
        }
        if (contRate < 0.38 && choppy) {
            tags.add(MarketEnvironmentState.DISTRIBUTION_ENV);
        }
        if (spyPersist < 0.35 && qqqPersistLow(trend)) {
            tags.add(MarketEnvironmentState.RANGE_COMPRESSION);
        }

        int modifier = 0;
        int cap = 100;
        boolean blockBreakout = false;
        boolean boost = false;

        if (tags.contains(MarketEnvironmentState.CHOP) && tags.contains(MarketEnvironmentState.LOW_PARTICIPATION)) {
            modifier -= 28;
            cap = 72;
        } else if (tags.contains(MarketEnvironmentState.CHOP)) {
            modifier -= 18;
            cap = 82;
        }
        if (tags.contains(MarketEnvironmentState.FAILED_BREAKOUT_ENV)) {
            modifier -= 22;
            blockBreakout = true;
            cap = Math.min(cap, 78);
        }
        if (tags.contains(MarketEnvironmentState.TREND_DAY_BULL)
                && (semi.contains("strong") || semi.contains("STRONG"))) {
            modifier += 14;
            boost = true;
        }
        if (tags.contains(MarketEnvironmentState.EXPANSION_ENV) && !choppy) {
            modifier += 8;
        }
        if (tags.contains(MarketEnvironmentState.MIDDAY_DRIFT) && tags.contains(MarketEnvironmentState.LOW_PARTICIPATION)) {
            modifier -= 12;
        }

        String summary = primary.name() + (tags.isEmpty() ? "" : " · " + tags.size() + " tags");
        return new MarketStructureAssessment(primary, List.copyOf(tags), modifier, cap, blockBreakout, boost, summary);
    }

    private static boolean qqqPersistLow(MarketTrendDto trend) {
        return trend != null && trend.getQqqPersistence() != null && trend.getQqqPersistence() < 0.35;
    }

    private static String safe(String s) {
        return s == null ? "" : s.toLowerCase(Locale.US);
    }
}
