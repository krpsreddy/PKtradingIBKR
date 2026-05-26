package com.tradingbot.signals;

/**
 * Canonical intraday signal type codes used across engine, API, and UI.
 */
public enum SignalType {
    MOM_BUY("MOM_BUY"),
    PULL_BUY("PULL_BUY"),
    CONT_BUY("CONT_BUY"),
    OPEN_MOM_BUY("OPEN_MOM_BUY"),
    OPEN_SCOUT("OPEN_SCOUT"),
    OPEN_FAIL("OPEN_FAIL"),
    OPEN_FAIL_BREAK("OPEN_FAIL_BREAK"),
    RECOVERY_FAIL("RECOVERY_FAIL"),
    IMBALANCE_DOWN("IMBALANCE_DOWN"),
    IMBALANCE_UP("IMBALANCE_UP"),
    EXIT("EXIT");

    private final String code;

    SignalType(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    public static boolean isBuySignal(String signalType) {
        return MOM_BUY.code.equals(signalType)
                || PULL_BUY.code.equals(signalType)
                || CONT_BUY.code.equals(signalType)
                || OPEN_MOM_BUY.code.equals(signalType);
    }
}
