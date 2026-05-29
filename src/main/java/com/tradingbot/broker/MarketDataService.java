package com.tradingbot.broker;

import com.tradingbot.broker.connection.BrokerConnectionManager;
import com.tradingbot.broker.model.BrokerConnectionStatusDto;
import com.tradingbot.ibkr.IBKRClientService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Scanner / trader market data facade — decoupled from raw IBKR socket.
 */
@Service
@RequiredArgsConstructor
public class MarketDataService {

    private final BrokerConnectionManager brokerConnectionManager;
    private final IBKRClientService ibkrClientService;

    public BrokerConnectionStatusDto brokerStatus() {
        return brokerConnectionManager.status();
    }

    public Double lastPrice(String symbol) {
        return ibkrClientService.getLastPrice(symbol);
    }

    public boolean isBrokerConnected() {
        return ibkrClientService.isConnected();
    }

    public boolean isStreaming() {
        return ibkrClientService.isLiveStreaming();
    }
}
