package com.tradingbot.bearish;

/** Phase 209 — manual PUT workflow grading (no auto execution). */
public enum PutAssistGrade {
    A_PLUS,
    A,
    B,
    AVOID;

    public boolean manualEligible() {
        return this != AVOID;
    }
}
