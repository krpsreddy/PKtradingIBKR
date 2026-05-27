package com.tradingbot.quotes;

public final class LiveQuoteDtos {

    private LiveQuoteDtos() {}

    public record QuoteDto(
            double price,
            Double change,
            Double changePercent,
            Long volume,
            long timestamp,
            boolean stale
    ) {}
}
