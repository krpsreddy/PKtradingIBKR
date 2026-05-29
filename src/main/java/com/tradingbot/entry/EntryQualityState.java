package com.tradingbot.entry;

/** Phase 197 — entry timing/structure grade for auto-execution gating. */
public enum EntryQualityState {
    IDEAL,
    EARLY,
    CONFIRMED,
    LATE,
    EXTENDED,
    CHASING,
    WEAK_STRUCTURE,
    LOW_PARTICIPATION
}
