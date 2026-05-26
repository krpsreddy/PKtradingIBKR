package com.tradingbot.signals;

import com.tradingbot.models.Candle;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OpeningRangeService {

    private final SymbolContextRegistry symbolContextRegistry;
    private final MarketHoursService marketHoursService;

    public void updateOpeningRange(String symbol, List<Candle> candles) {
        if (candles == null || candles.isEmpty()) {
            return;
        }
        LocalDate sessionDay = MarketTime.now().toLocalDate();
        Candle firstBar = candles.stream()
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .filter(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalDate().equals(sessionDay))
                .min(Comparator.comparing(Candle::getOpenTime))
                .orElse(null);
        if (firstBar == null) {
            return;
        }

        SymbolContext ctx = symbolContextRegistry.getOrCreate(symbol);
        if (ctx.getOpeningRangeSessionDate() == null || !sessionDay.equals(ctx.getOpeningRangeSessionDate())) {
            ctx.setOpeningRangeSessionDate(sessionDay);
            ctx.setOpeningRangeHigh(firstBar.getHigh());
            ctx.setOpeningRangeLow(firstBar.getLow());
        }
    }

    public BigDecimal getOpeningRangeHigh(SymbolContext ctx) {
        return ctx != null ? ctx.getOpeningRangeHigh() : null;
    }

    public BigDecimal getOpeningRangeLow(SymbolContext ctx) {
        return ctx != null ? ctx.getOpeningRangeLow() : null;
    }
}
