package com.tradingbot.sessionintelligence.api;

import com.tradingbot.sessionintelligence.PremarketIntelligenceService;
import com.tradingbot.sessionintelligence.premarket.PremarketSnapshotDto;
import com.tradingbot.sessionintelligence.session.PremarketSessionWindow;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/session/premarket")
@RequiredArgsConstructor
public class PremarketIntelligenceController {

    private final PremarketIntelligenceService service;
    private final PremarketSessionWindow sessionWindow;

    @GetMapping("/window")
    public Map<String, Object> window() {
        return Map.of(
                "active", sessionWindow.isActivePremarketIntelligenceWindow(),
                "openTransition", sessionWindow.isOpenTransitionWindow()
        );
    }

    @GetMapping("/{symbol}")
    public PremarketSnapshotDto symbol(@PathVariable String symbol) {
        service.refreshSymbol(symbol);
        return service.get(symbol).orElse(PremarketSnapshotDto.empty(symbol));
    }

    @GetMapping("/snapshots")
    public List<PremarketSnapshotDto> snapshots() {
        return service.allSnapshots().stream().limit(40).toList();
    }
}
