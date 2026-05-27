package com.tradingbot.paper;

/** Canonical execution mode — only OFF and PAPER_RESEARCH are active in Phase 181. */
public enum PaperExecutionMode {
    OFF,
    PAPER_RESEARCH,
    PAPER_SELECTIVE,
    LIVE_ASSISTED,
    LIVE_AUTO;

    public boolean allowsAutomatedEntry() {
        return this == PAPER_RESEARCH || this == PAPER_SELECTIVE;
    }

    public boolean isLiveFamily() {
        return this == LIVE_ASSISTED || this == LIVE_AUTO;
    }
}
