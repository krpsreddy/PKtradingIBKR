package com.tradingbot.broker.connection;

import com.tradingbot.broker.model.BrokerProfile;

public interface BrokerConnectionLifecycleListener {

    void onSocketConnected(BrokerProfile profile);

    void onReady(BrokerProfile profile);

    void onDisconnected();
}
