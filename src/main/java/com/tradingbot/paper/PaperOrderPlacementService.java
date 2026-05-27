package com.tradingbot.paper;

import com.ib.client.Contract;
import com.ib.client.Decimal;
import com.ib.client.EClientSocket;
import com.ib.client.Order;
import com.ib.client.Types;
import com.tradingbot.config.PaperExecutionProperties;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.models.PaperExecutionRecord;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaperOrderPlacementService {

    private final IBKRClientService ibkrClientService;
    private final PaperExecutionProperties properties;

    public PlacementResult placeOneShareBuy(PaperExecutionRecord record) {
        if (!ibkrClientService.isReadyForOrders()) {
            return PlacementResult.failed("IBKR API not ready (awaiting nextValidId)");
        }
        EClientSocket client = ibkrClientService.getApiClient();
        if (client == null || !client.isConnected()) {
            return PlacementResult.failed("IBKR client disconnected");
        }
        int orderId = ibkrClientService.allocateOrderId();
        Contract contract = stockContract(record.getSymbol());
        Order order = marketBuyOrder(properties.getFixedQuantity());
        long t0 = System.currentTimeMillis();
        client.placeOrder(orderId, contract, order);
        log.info("Paper research order placed symbol={} orderId={} qty={}",
                record.getSymbol(), orderId, properties.getFixedQuantity());
        return PlacementResult.submitted(orderId, System.currentTimeMillis() - t0);
    }

    private Contract stockContract(String symbol) {
        Contract c = new Contract();
        c.symbol(symbol.toUpperCase());
        c.secType(Types.SecType.STK.name());
        c.currency("USD");
        c.exchange("SMART");
        c.primaryExch("NASDAQ");
        return c;
    }

    private Order marketBuyOrder(int qty) {
        Order order = new Order();
        order.action(Types.Action.BUY.name());
        order.orderType(properties.getOrderType());
        order.totalQuantity(Decimal.get(qty));
        order.tif("DAY");
        order.transmit(true);
        return order;
    }

    public record PlacementResult(
            boolean success,
            String error,
            Integer orderId,
            Long latencyMs
    ) {
        static PlacementResult submitted(int orderId, long latencyMs) {
            return new PlacementResult(true, null, orderId, latencyMs);
        }

        static PlacementResult failed(String error) {
            return new PlacementResult(false, error, null, null);
        }
    }
}
