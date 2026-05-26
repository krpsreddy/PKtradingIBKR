package com.tradingbot.intelligence;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorCalculationService;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.EmergingSetupDto;
import com.tradingbot.models.TradingSymbol;
import com.tradingbot.repository.CandleRepository;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.TradingSymbolService;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EmergingSetupService {

    private final SymbolContextRegistry symbolContextRegistry;
    private final TradingSymbolService tradingSymbolService;
    private final IndicatorCalculationService indicatorCalculationService;
    private final CandleRepository candleRepository;
    private final MarketHoursService marketHoursService;
    private final TradingProperties tradingProperties;
    private final IntradayIntelligenceService intradayIntelligenceService;

    public List<EmergingSetupDto> scanEmergingSetups() {
        List<EmergingSetupDto> results = new ArrayList<>();
        for (TradingSymbol row : tradingSymbolService.findEnabledForDisplay()) {
            String sym = row.getSymbol().toUpperCase();
            SymbolContext ctx = symbolContextRegistry.get(sym);
            if (ctx == null) continue;

            EmergingSetupDto setup = detect(sym, ctx);
            if (setup != null) {
                results.add(setup);
            }
        }
        results.sort(Comparator
                .comparing(EmergingSetupDto::getState, this::stateOrder)
                .thenComparing(EmergingSetupDto::getRankScore, Comparator.nullsLast(Comparator.reverseOrder())));
        return results;
    }

    private EmergingSetupDto detect(String symbol, SymbolContext ctx) {
        String readiness = ctx.getReadinessState();
        String openReadiness = ctx.getOpenReadinessState();
        String signalState = ctx.getSignalState();

        String state = null;
        String setupType = null;
        String description = null;

        if ("CONT_READY".equals(readiness)) {
            state = "NEAR_TRIGGER";
            setupType = "CONTINUATION";
            description = "Continuation building near trigger";
        } else if ("OPEN_READY".equals(openReadiness)) {
            state = "READYING";
            setupType = "OPEN";
            description = "Opening momentum forming";
        } else if ("OPEN_SCOUT".equals(signalState) || ctx.isOpenScoutActive()) {
            state = "BUILDING";
            setupType = "OPEN_SCOUT";
            description = "Opening scout — coiling near highs";
        } else if ("PULL_BUY".equals(signalState) || "PULL".equals(readiness)) {
            state = "BUILDING";
            setupType = "PULLBACK";
            description = "Pullback setup — VWAP reclaim attempt";
        }

        if (state == null) return null;

        IndicatorResult ind = loadIndicators(symbol);
        double rvol = ind != null && ind.getRelativeVolume() != null
                ? ind.getRelativeVolume().doubleValue() : 0;
        Integer rank = null;
        try {
            rank = intradayIntelligenceService.analyzeSymbol(symbol, ind, null).getRank().getRankScore();
        } catch (Exception ignored) {
        }

        return EmergingSetupDto.builder()
                .symbol(symbol)
                .state(state)
                .setupType(setupType)
                .description(description)
                .relativeVolume(rvol > 0 ? rvol : null)
                .rankScore(rank)
                .build();
    }

    private int stateOrder(String a, String b) {
        return Integer.compare(priority(a), priority(b));
    }

    private int priority(String state) {
        if ("NEAR_TRIGGER".equals(state)) return 0;
        if ("READYING".equals(state)) return 1;
        return 2;
    }

    private IndicatorResult loadIndicators(String symbol) {
        var candles = candleRepository
                .findTop100BySymbolAndTimeframeOrderByOpenTimeDesc(symbol, tradingProperties.getTimeframe())
                .stream()
                .filter(c -> marketHoursService.isRegularSessionCandle(c.getOpenTime()))
                .sorted(Comparator.comparing(com.tradingbot.models.Candle::getOpenTime))
                .toList();
        if (candles.size() < 20) return null;
        return indicatorCalculationService.calculateIndicators(candles);
    }
}
