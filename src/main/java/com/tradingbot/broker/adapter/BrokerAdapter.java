package com.tradingbot.broker.adapter;

import com.tradingbot.broker.model.BrokerConnectionStatusDto;
import com.tradingbot.broker.model.BrokerProfile;

import java.util.concurrent.CompletableFuture;

/** Broker-agnostic connection surface (IBKR, Polygon, Replay, …). */
public interface BrokerAdapter {

    String adapterType();

    boolean supports(BrokerProfile profile);

    CompletableFuture<Void> connect(BrokerProfile profile);

    void disconnect();

    CompletableFuture<Void> reconnect();

    BrokerConnectionStatusDto status();

    boolean isConnected();

    boolean isReady();
}
