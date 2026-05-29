package com.tradingbot.ibkr;

import com.ib.client.Bar;
import com.ib.client.Decimal;
import com.ib.client.DefaultEWrapper;
import com.ib.client.TickAttrib;
import com.ib.client.Util;
import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
public class IBKRWrapper extends DefaultEWrapper {

    private final IBKRClientService clientService;
    private final HistoricalDataService historicalDataService;
    private final AtomicInteger marketDataSubscriptionNotes = new AtomicInteger(0);
    private final AtomicBoolean marketDataSubscriptionNoteLogged = new AtomicBoolean(false);
    private final AtomicBoolean tickerCapNoteLogged = new AtomicBoolean(false);

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
        clientService.onNextValidId(orderId);
    }

    @Override
    public void managedAccounts(String accountsList) {
        log.info("IBKR managedAccounts received");
        clientService.onManagedAccounts();
    }

    @Override
    public void orderStatus(int orderId, String status, Decimal filled, Decimal remaining,
                            double avgFillPrice, long permId, int parentId, double lastFillPrice,
                            int clientId, String whyHeld, double mktCapPrice) {
        if ("Filled".equalsIgnoreCase(status) && avgFillPrice > 0) {
            clientService.onOrderFilled(orderId, avgFillPrice);
        }
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
            if (errorCode == 2104 || errorCode == 2106) {
                clientService.onMarketDataFarmHealthy();
            }
            return;
        }
        if (errorCode == 101 && errorMsg != null && errorMsg.toLowerCase().contains("max number of tickers")) {
            log.debug("IBKR ticker cap [{}] id={}: {}", errorCode, id, errorMsg);
            if (tickerCapNoteLogged.compareAndSet(false, true)) {
                log.warn(
                        "IBKR max concurrent tickers reached (code 101) — live streams capped; "
                                + "lower ibkr.max-live-streams or reduce subscribeLive symbols"
                );
            }
            clientService.onMaxTickersReached();
            return;
        }
        if (errorCode == 10089) {
            int n = marketDataSubscriptionNotes.incrementAndGet();
            log.debug("IBKR market data note [{}] (#{}): {}", errorCode, n, errorMsg);
            if (marketDataSubscriptionNoteLogged.compareAndSet(false, true)) {
                log.info(
                        "IBKR: no live API market-data subscription for requested symbols — delayed quotes used (code 10089). "
                                + "Use ibkr.market-data-type=3 or add subscriptions in TWS/Gateway."
                );
            }
            return;
        }
        if (errorCode == 10168) {
            clientService.onMarketDataEntitlementError(id, errorMsg);
            return;
        }
        if (historicalDataService.isHistoricalRequest(id)) {
            log.warn("IBKR historical data error [{}]: {}", errorCode, errorMsg);
            clientService.onHistoricalFailed(id);
            return;
        }
        if (errorCode == 326) {
            log.warn("IBKR error id={} code={}: {}", id, errorCode, errorMsg);
            clientService.onClientIdInUse();
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
