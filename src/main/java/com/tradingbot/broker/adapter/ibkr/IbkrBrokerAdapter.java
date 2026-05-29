package com.tradingbot.broker.adapter.ibkr;

import com.tradingbot.broker.adapter.BrokerAdapter;
import com.tradingbot.broker.connection.BrokerConnectionManager;
import com.tradingbot.broker.model.BrokerConnectionStatusDto;
import com.tradingbot.broker.model.BrokerProfile;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;

@Component
public class IbkrBrokerAdapter implements BrokerAdapter {

    private final BrokerConnectionManager connectionManager;

    public IbkrBrokerAdapter(@Lazy BrokerConnectionManager connectionManager) {
        this.connectionManager = connectionManager;
    }

    @Override
    public String adapterType() {
        return "IBKR";
    }

    @Override
    public boolean supports(BrokerProfile profile) {
        return profile == null || "IBKR".equalsIgnoreCase(profile.adapterType());
    }

    @Override
    public CompletableFuture<Void> connect(BrokerProfile profile) {
        return connectionManager.connect(profile.id());
    }

    @Override
    public void disconnect() {
        connectionManager.disconnect();
    }

    @Override
    public CompletableFuture<Void> reconnect() {
        return connectionManager.reconnect();
    }

    @Override
    public BrokerConnectionStatusDto status() {
        return connectionManager.status();
    }

    @Override
    public boolean isConnected() {
        return connectionManager.status().connected();
    }

    @Override
    public boolean isReady() {
        return connectionManager.status().ready();
    }
}
