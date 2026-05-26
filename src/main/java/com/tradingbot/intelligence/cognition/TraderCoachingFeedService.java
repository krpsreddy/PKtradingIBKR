package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.BehaviorInsightDto;
import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.CoachingFeedItemDto;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TraderCoachingFeedService {

    public List<CoachingFeedItemDto> feed(List<BehaviorInsightDto> behavior,
                                          MarketMemoryDto memory,
                                          MarketTrendDto trend) {
        List<CoachingFeedItemDto> items = new ArrayList<>();
        long ts = MarketTime.nowLocal().atZone(com.tradingbot.services.MarketHoursService.MARKET_ZONE).toInstant().toEpochMilli();

        for (BehaviorInsightDto b : behavior) {
            items.add(CoachingFeedItemDto.builder()
                    .type(b.getType())
                    .message(b.getTitle())
                    .severity(severityFor(b.getType()))
                    .timestamp(ts)
                    .build());
        }

        if (memory != null && memory.getContinuationSuccessRate() != null
                && memory.getContinuationSuccessRate() >= 0.6) {
            items.add(item("SETUP_TREND", "Continuation setups outperforming today", "info", ts));
        }

        if (trend != null && trend.isChoppy()) {
            items.add(item("REGIME", "You are trading in CHOPPY regime — reduce aggression", "warn", ts));
        }

        if (memory != null && !memory.getFailingSetups().isEmpty()) {
            items.add(item("AVOID", "Avoid low-quality " + memory.getFailingSetups().get(0) + " today", "warn", ts));
        }

        if (items.stream().noneMatch(i -> i.getType().equals("LATE_ENTRIES"))) {
            items.add(item("PROCESS", "Best trades today came from EARLY entries", "info", ts));
        }

        return items.stream().limit(6).toList();
    }

    private CoachingFeedItemDto item(String type, String msg, String sev, long ts) {
        return CoachingFeedItemDto.builder().type(type).message(msg).severity(sev).timestamp(ts).build();
    }

    private String severityFor(String type) {
        if (type == null) return "info";
        return switch (type.toUpperCase()) {
            case "LATE_ENTRIES", "CHASING", "OVERTRADING", "REVENGE" -> "warn";
            case "POSITIVE" -> "good";
            default -> "info";
        };
    }
}
