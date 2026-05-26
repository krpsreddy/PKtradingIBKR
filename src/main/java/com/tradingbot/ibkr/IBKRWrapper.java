package com.tradingbot.ibkr;

import com.ib.client.Bar;
import com.ib.client.DefaultEWrapper;
import com.ib.client.Decimal;
import com.ib.client.TickAttrib;
import com.ib.client.Util;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class IBKRWrapper extends DefaultEWrapper {

    private final IBKRClientService clientService;
    private final HistoricalDataService historicalDataService;

    public IBKRWrapper(IBKRClientService clientService, HistoricalDataService historicalDataService) {
        this.clientService = clientService;
        this.historicalDataService = historicalDataService;
    }

    @Override
    public void connectAck() {
        clientService.onConnected();
    }

    @Override
    public void connectionClosed() {
        log.warn("IBKR connection closed");
        clientService.onDisconnected();
    }

    @Override
    public void nextValidId(int orderId) {
        log.info("IBKR nextValidId={}", orderId);
        clientService.onReady();
    }

    @Override
    public void error(int id, long errorTime, int errorCode, String errorMsg, String advancedOrderRejectJson) {
        handleError(id, errorCode, errorMsg);
    }

    @Override
    public void error(Exception e) {
        log.error("IBKR exception", e);
    }

    @Override
    public void error(String str) {
        log.error("IBKR error: {}", str);
    }

    private void handleError(int id, int errorCode, String errorMsg) {
        if (errorCode == 2104 || errorCode == 2106 || errorCode == 2158) {
            log.debug("IBKR info [{}]: {}", errorCode, errorMsg);
            return;
        }
        if (errorCode == 10089) {
            log.info("IBKR market data note [{}]: {}", errorCode, errorMsg);
            return;
        }
        if (historicalDataService.isHistoricalRequest(id)) {
            log.warn("IBKR historical data error [{}]: {}", errorCode, errorMsg);
            clientService.onHistoricalFailed(id);
            return;
        }
        if (errorCode == 502) {
            log.error("IBKR connection failed: {}", errorMsg);
            clientService.onDisconnected();
            return;
        }
        log.warn("IBKR error id={} code={}: {}", id, errorCode, errorMsg);
    }

    @Override
    public void historicalData(int reqId, Bar bar) {
        clientService.onHistoricalBar(reqId, bar);
    }

    @Override
    public void historicalDataEnd(int reqId, String startDateStr, String endDateStr) {
        log.info("IBKR historicalDataEnd reqId={} start={} end={}", reqId, startDateStr, endDateStr);
        clientService.onHistoricalDataEnd(reqId);
    }

    @Override
    public void tickPrice(int tickerId, int field, double price, TickAttrib attribs) {
        clientService.onTickPrice(tickerId, field, price);
    }

    @Override
    public void tickSize(int tickerId, int field, Decimal size) {
        if (size != null && !Util.StringIsEmpty(size.toString())) {
            clientService.onTickSize(tickerId, field, size.value().doubleValue());
        }
    }
}
