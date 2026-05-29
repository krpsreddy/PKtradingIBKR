package com.tradingbot.broker.model;

public enum BrokerConnectionPhase {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    RESTORING_STREAMS,
    RECONNECT_FAILED,
    SWITCHED
}
