package com.tradingbot.signals;

import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.repository.TradingSignalRepository;
import com.tradingbot.services.MarketTime;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SignalLifecycleService {

    private final TradingSignalRepository tradingSignalRepository;
    private final SymbolContextRegistry symbolContextRegistry;

    public void onSignalCreated(TradingSignal signal) {
        signal.setLifecycleState(SignalLifecycleState.NEW);
        signal.setLastUpdated(MarketTime.nowLocal());
        symbolContextRegistry.updateSignalState(signal.getSymbol(), signal.getSignalType(), signal.getLifecycleState());
    }

    public void refreshLifecycle(String symbol, IndicatorResult indicators) {
        if (indicators == null || !indicators.isValid()) {
            return;
        }
        LocalDateTime since = MarketTime.nowLocal().minusHours(4);
        List<TradingSignal> openSignals = tradingSignalRepository
                .findBySymbolAndTimestampAfterOrderByTimestampDesc(symbol.toUpperCase(), since)
                .stream()
                .filter(s -> !SignalLifecycleState.EXITED.equals(s.getLifecycleState())
                        && !SignalLifecycleState.INVALIDATED.equals(s.getLifecycleState()))
                .filter(s -> SignalType.isBuySignal(s.getSignalType()))
                .toList();

        for (TradingSignal signal : openSignals) {
            String current = signal.getLifecycleState() != null ? signal.getLifecycleState() : SignalLifecycleState.NEW;
            String next = resolveNextState(current, indicators);
            if (!next.equals(current)) {
                signal.setLifecycleState(next);
                signal.setLastUpdated(MarketTime.nowLocal());
                if (SignalLifecycleState.INVALIDATED.equals(next)) {
                    signal.setInvalidationReason(buildInvalidationReason(indicators));
                }
                tradingSignalRepository.save(signal);
                symbolContextRegistry.updateSignalState(symbol, signal.getSignalType(), next);
                log.debug("Signal lifecycle {} {} -> {}", symbol, signal.getSignalType(), next);
            }
        }
    }

    public void markExited(String symbol, TradingSignal exitSignal) {
        LocalDateTime since = MarketTime.nowLocal().minusHours(4);
        tradingSignalRepository.findBySymbolAndTimestampAfterOrderByTimestampDesc(symbol.toUpperCase(), since)
                .stream()
                .filter(s -> SignalType.isBuySignal(s.getSignalType()))
                .filter(s -> !SignalLifecycleState.EXITED.equals(s.getLifecycleState()))
                .forEach(s -> {
                    s.setLifecycleState(SignalLifecycleState.EXITED);
                    s.setLastUpdated(MarketTime.nowLocal());
                    s.setInvalidationReason("Exit signal at " + exitSignal.getPrice());
                    tradingSignalRepository.save(s);
                });
        symbolContextRegistry.updateSignalState(symbol, SignalEngineService.EXIT, SignalLifecycleState.EXITED);
    }

    private String resolveNextState(String current, IndicatorResult i) {
        if (SignalLifecycleState.NEW.equals(current)) {
            return SignalLifecycleState.ACTIVE;
        }
        if (isInvalidated(i)) {
            return SignalLifecycleState.INVALIDATED;
        }
        if (isWeakening(i)) {
            return SignalLifecycleState.WEAKENING;
        }
        return SignalLifecycleState.ACTIVE;
    }

    private boolean isInvalidated(IndicatorResult i) {
        return i.getClose().compareTo(i.getVwap()) < 0
                || i.getEma9().compareTo(i.getEma20()) < 0;
    }

    private boolean isWeakening(IndicatorResult i) {
        return i.getMacd().compareTo(i.getSignalLine()) <= 0
                || i.getRsi().compareTo(BigDecimal.valueOf(55)) < 0;
    }

    private String buildInvalidationReason(IndicatorResult i) {
        if (i.getClose().compareTo(i.getVwap()) < 0) {
            return "Price below VWAP";
        }
        if (i.getEma9().compareTo(i.getEma20()) < 0) {
            return "EMA9 crossed below EMA20";
        }
        return "Conditions broken";
    }
}
