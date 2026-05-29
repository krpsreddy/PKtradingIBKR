package com.tradingbot.ibkr.connection;

/** Phase 216 — explicit IBKR connection lifecycle (not collapsed into "connected"). */
public enum IbkrConnectionPhase {
    DISCONNECTED,
    SOCKET_CONNECTED,
    API_READY,
    IBKR_READY,
    STREAM_ACTIVE,
    DATA_HEALTHY
}
