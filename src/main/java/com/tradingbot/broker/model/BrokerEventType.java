package com.tradingbot.broker.model;

public enum BrokerEventType {
    BROKER_CONNECTING,
    BROKER_CONNECTED,
    BROKER_DISCONNECTED,
    BROKER_RESTORING_STREAMS,
    BROKER_RECONNECT_FAILED,
    BROKER_SWITCHED
}
