package com.tradingbot.services.strategymemory;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Phase 167 — strategy memory registry API. */
@RestController
@RequestMapping("/api/strategy-memory")
@RequiredArgsConstructor
public class StrategyMemoryRegistryController {

    private final StrategyMemoryRegistryService registry;

    @GetMapping
    public List<StrategyDefinition> list(@RequestParam(required = false, defaultValue = "false") boolean activeOnly) {
        return activeOnly ? registry.active() : registry.all();
    }

    @GetMapping("/{strategyId}")
    public StrategyDefinition get(@PathVariable String strategyId) {
        return registry.find(strategyId.toUpperCase())
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Strategy not found"));
    }

    @PatchMapping("/{strategyId}/active")
    public Map<String, Object> setActive(@PathVariable String strategyId, @RequestBody Map<String, Boolean> body) {
        boolean active = Boolean.TRUE.equals(body.get("active"));
        if (!registry.setActive(strategyId.toUpperCase(), active)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Strategy not found");
        }
        return Map.of("strategyId", strategyId.toUpperCase(), "active", active);
    }

    @PatchMapping("/{strategyId}/thresholds")
    public StrategyDefinition updateThresholds(
            @PathVariable String strategyId,
            @RequestBody Map<String, Object> body
    ) {
        @SuppressWarnings("unchecked")
        Map<String, Object> thresholds = body.get("thresholds") instanceof Map<?, ?> m
                ? (Map<String, Object>) m : Map.of();
        String notes = body.get("notes") instanceof String s ? s : null;
        return registry.updateThresholds(strategyId.toUpperCase(), thresholds, notes)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Strategy not found"));
    }
}
