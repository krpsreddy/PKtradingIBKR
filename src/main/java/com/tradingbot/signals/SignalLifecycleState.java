package com.tradingbot.signals;

public final class SignalLifecycleState {
    public static final String NEW = "NEW";
    public static final String ACTIVE = "ACTIVE";
    public static final String WEAKENING = "WEAKENING";
    public static final String INVALIDATED = "INVALIDATED";
    public static final String EXITED = "EXITED";
    public static final String OPEN_SCOUT_FAILED = "OPEN_SCOUT_FAILED";

    private SignalLifecycleState() {}
}
