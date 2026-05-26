package com.tradingbot.intelligence;

import com.tradingbot.config.TradingProperties;
import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.ExtendedStateDto;
import com.tradingbot.models.Candle;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExtendedConditionService {

    private final CandleAggregationService candleAggregationService;
    private final TradingProperties tradingProperties;

    public ExtendedStateDto evaluate(IndicatorResult indicators, List<Candle> sessionCandles) {
        if (indicators == null || !indicators.isValid()) {
            return none();
        }

        List<String> reasons = new ArrayList<>();
        boolean rsiExtreme = indicators.getRsi().compareTo(BigDecimal.valueOf(75)) > 0
                || indicators.getRsi().compareTo(BigDecimal.valueOf(25)) < 0;
        if (rsiExtreme) {
            reasons.add("RSI extreme");
        }

        boolean ema9Ext = distancePct(indicators.getClose(), indicators.getEma9())
                > tradingProperties.getExtendedMaxEma9DistPct();
        if (ema9Ext) {
            reasons.add("Far from EMA9");
        }

        boolean vwapExt = indicators.getVwap().compareTo(BigDecimal.ZERO) > 0
                && distancePct(indicators.getClose(), indicators.getVwap())
                > tradingProperties.getExtendedMaxVwapDistPct();
        if (vwapExt) {
            reasons.add("Far from VWAP");
        }

        boolean vertical = false;
        if (sessionCandles != null && sessionCandles.size() >= 5) {
            List<Candle> sorted = sessionCandles.stream()
                    .sorted(Comparator.comparing(Candle::getOpenTime))
                    .toList();
            double move = candleAggregationService.verticalMovePct(sorted,
                    tradingProperties.getExtendedVerticalLookbackBars());
            if (move > tradingProperties.getExtendedVerticalMovePct()) {
                vertical = true;
                reasons.add("Vertical move");
            }
        }

        boolean extended = rsiExtreme || ema9Ext || vwapExt || vertical;
        if (!extended) {
            return none();
        }

        boolean bull = indicators.getClose().compareTo(indicators.getOpen()) >= 0
                || indicators.getRsi().compareTo(BigDecimal.valueOf(50)) > 0;
        String state = bull ? "EXTENDED_BULL" : "EXTENDED_BEAR";

        return ExtendedStateDto.builder()
                .extended(true)
                .state(state)
                .reasons(reasons)
                .optionsWarning("Late options entry risk")
                .build();
    }

    private ExtendedStateDto none() {
        return ExtendedStateDto.builder()
                .extended(false)
                .state("NONE")
                .reasons(List.of())
                .optionsWarning(null)
                .build();
    }

    private double distancePct(BigDecimal price, BigDecimal ref) {
        if (ref == null || ref.compareTo(BigDecimal.ZERO) <= 0 || price == null) {
            return 0;
        }
        return price.subtract(ref).abs()
                .divide(ref, 4, RoundingMode.HALF_UP)
                .doubleValue();
    }
}
