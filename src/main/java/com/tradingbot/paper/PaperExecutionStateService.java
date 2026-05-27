package com.tradingbot.paper;

import com.tradingbot.config.PaperExecutionProperties;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicReference;

/** In-memory execution mode (persisted mode also exposed via API for UI). */
@Service
public class PaperExecutionStateService {

    private final AtomicReference<PaperExecutionMode> mode = new AtomicReference<>(PaperExecutionMode.OFF);
    private final PaperExecutionProperties properties;

    public PaperExecutionStateService(PaperExecutionProperties properties) {
        this.properties = properties;
        if (properties.isResearchEnabled()) {
            mode.set(PaperExecutionMode.OFF);
        }
    }

    public PaperExecutionMode getMode() {
        return mode.get();
    }

    public PaperExecutionMode setMode(PaperExecutionMode next) {
        if (next == null) {
            next = PaperExecutionMode.OFF;
        }
        if (next.isLiveFamily() || next == PaperExecutionMode.PAPER_SELECTIVE) {
            throw new IllegalArgumentException(next.name() + " is not enabled in Phase 181");
        }
        mode.set(next);
        return next;
    }

    public boolean isResearchInfrastructureEnabled() {
        return properties.isResearchEnabled();
    }
}
