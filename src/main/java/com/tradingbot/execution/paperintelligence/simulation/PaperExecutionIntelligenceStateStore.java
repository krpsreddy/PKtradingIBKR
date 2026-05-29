package com.tradingbot.execution.paperintelligence.simulation;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PaperExecutionIntelligenceStateStore {

    private final Map<Long, PaperExecutionIntelligenceState> byPaperId = new ConcurrentHashMap<>();

    public void put(PaperExecutionIntelligenceState state) {
        byPaperId.put(state.paperExecutionId(), state);
    }

    public Optional<PaperExecutionIntelligenceState> get(Long paperId) {
        return Optional.ofNullable(byPaperId.get(paperId));
    }

    public void remove(Long paperId) {
        byPaperId.remove(paperId);
    }
}
