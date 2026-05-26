package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.BehaviorInsightDto;
import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.IntelligenceEventDto;
import com.tradingbot.intelligence.EmergingSetupService;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IntelligenceEventStreamService {

    private final EmergingSetupService emergingSetupService;

    public List<IntelligenceEventDto> events(MarketTrendDto trend,
                                             MarketMemoryDto memory,
                                             List<BehaviorInsightDto> behavior,
                                             String selectedSymbol) {
        List<IntelligenceEventDto> out = new ArrayList<>();
        long ts = MarketTime.nowLocal().atZone(com.tradingbot.services.MarketHoursService.MARKET_ZONE).toInstant().toEpochMilli();

        emergingSetupService.scanEmergingSetups().stream()
                .filter(e -> e.getState() != null && e.getState().toUpperCase().contains("READY"))
                .limit(2)
                .forEach(e -> out.add(event("SETUP_EMERGING", "Strong setup emerging: " + e.getSymbol() + " " + e.getSetupType(),
                        "high", e.getSymbol(), ts)));

        if (memory != null && !memory.getFailingSetups().isEmpty()) {
            out.add(event("SETUP_DETERIORATING", memory.getFailingSetups().get(0) + " underperforming today",
                    "medium", null, ts));
        }

        if (trend != null && trend.isChoppy()) {
            out.add(event("REGIME_SHIFT", "CHOPPY regime active — downgrade momentum setups", "medium", null, ts));
        }

        if (trend != null && "STRONG".equals(trend.getSemiBreadth())) {
            out.add(event("BREADTH_EXPANSION", "Semiconductor breadth expanding", "info", null, ts));
        }

        for (BehaviorInsightDto b : behavior) {
            if (!"POSITIVE".equals(b.getType())) {
                out.add(event("BEHAVIOR_WARNING", b.getTitle(), "warn", null, ts));
            }
        }

        if (memory != null && !memory.getStrongestSetups().isEmpty()) {
            out.add(event("RANKING_CHANGE", memory.getStrongestSetups().get(0) + " ranked highest today",
                    "info", null, ts));
        }

        if (selectedSymbol != null && !selectedSymbol.isBlank()) {
            out.add(event("FOCUS", "Analyzing " + selectedSymbol.toUpperCase(), "info", selectedSymbol.toUpperCase(), ts));
        }

        return out.stream().limit(8).toList();
    }

    private IntelligenceEventDto event(String type, String msg, String sev, String sym, long ts) {
        return IntelligenceEventDto.builder()
                .id(UUID.randomUUID().toString().substring(0, 8))
                .type(type)
                .message(msg)
                .severity(sev)
                .symbol(sym)
                .timestamp(ts)
                .build();
    }
}
