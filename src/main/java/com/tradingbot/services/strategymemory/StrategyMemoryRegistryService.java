package com.tradingbot.services.strategymemory;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** Phase 167 — persistent strategy memory registry (JSON definitions). */
@Slf4j
@Service
public class StrategyMemoryRegistryService {

    private final ObjectMapper objectMapper;
    private final Map<String, StrategyDefinition> strategies = new ConcurrentHashMap<>();

    public StrategyMemoryRegistryService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void loadDefinitions() {
        try {
            Resource[] resources = new PathMatchingResourcePatternResolver()
                    .getResources("classpath:strategies/*.json");
            for (Resource resource : resources) {
                StrategyDefinition def = objectMapper.readValue(resource.getInputStream(), StrategyDefinition.class);
                strategies.put(def.strategyId(), def);
                log.info("Loaded strategy definition: {} v{}", def.strategyId(), def.version());
            }
        } catch (IOException e) {
            log.warn("Failed to load strategy definitions: {}", e.getMessage());
        }
    }

    public List<StrategyDefinition> all() {
        return strategies.values().stream()
                .sorted(Comparator.comparing(StrategyDefinition::strategyId))
                .toList();
    }

    public List<StrategyDefinition> active() {
        return all().stream().filter(StrategyDefinition::active).filter(d -> !d.deprecated()).toList();
    }

    public Optional<StrategyDefinition> find(String strategyId) {
        return Optional.ofNullable(strategies.get(strategyId));
    }

    public boolean setActive(String strategyId, boolean active) {
        StrategyDefinition existing = strategies.get(strategyId);
        if (existing == null) return false;
        strategies.put(strategyId, copy(existing, active, existing.thresholds(), existing.notes()));
        return true;
    }

    public Optional<StrategyDefinition> updateThresholds(
            String strategyId,
            Map<String, Object> thresholds,
            String notes
    ) {
        StrategyDefinition existing = strategies.get(strategyId);
        if (existing == null) return Optional.empty();
        Map<String, Object> merged = new HashMap<>(existing.thresholds() != null ? existing.thresholds() : Map.of());
        if (thresholds != null) merged.putAll(thresholds);
        String mergedNotes = notes != null ? notes : existing.notes();
        StrategyDefinition updated = copy(existing, existing.active(), merged, mergedNotes);
        strategies.put(strategyId, updated);
        return Optional.of(updated);
    }

    private static StrategyDefinition copy(
            StrategyDefinition existing,
            boolean active,
            Map<String, Object> thresholds,
            String notes
    ) {
        return new StrategyDefinition(
                existing.strategyId(), existing.strategyName(), existing.category(),
                existing.conditions(), thresholds,
                existing.winRate(), existing.avgR(), existing.robustness(),
                active, existing.deprecated(), existing.replayExamples(),
                existing.discoveredFromPhase(), notes, existing.version(),
                existing.governanceTags()
        );
    }

    public Optional<StrategyDefinition> matchOpportunityType(String opportunityType) {
        if (opportunityType == null) return Optional.empty();
        String key = opportunityType.toUpperCase();
        return find(key).or(() -> {
            if (key.contains("VWAP")) return find("VWAP_ACCEPTANCE_PERSISTENCE");
            if (key.contains("COMPRESSION")) return find("COMPRESSION_BREAKOUT");
            if (key.contains("EXHAUSTION")) return find("LATE_STAGE_EXHAUSTION");
            if (key.contains("PULLBACK")) return find("SHALLOW_PULLBACK_CONTINUATION");
            if (key.contains("EXPANSION") || key.contains("CONTINUATION")) return find("EARLY_EXPANSION");
            return Optional.empty();
        });
    }
}
