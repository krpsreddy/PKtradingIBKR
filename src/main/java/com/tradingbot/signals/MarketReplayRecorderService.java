package com.tradingbot.signals;

import com.tradingbot.models.SignalEvaluationSnapshot;
import com.tradingbot.repository.SignalEvaluationSnapshotRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MarketReplayRecorderService {

    private final SignalEvaluationSnapshotRepository repository;

    public void record(String symbol, String signalType, String lifecycleState, int score,
                       Map<String, Boolean> conditions, BigDecimal price, Long volume,
                       BigDecimal rvol, String vwapState) {
        if (conditions == null || conditions.isEmpty()) {
            return;
        }
        List<String> passed = conditions.entrySet().stream()
                .filter(Map.Entry::getValue)
                .map(Map.Entry::getKey)
                .toList();
        List<String> failed = conditions.entrySet().stream()
                .filter(e -> !e.getValue())
                .map(Map.Entry::getKey)
                .toList();

        SignalEvaluationSnapshot snap = SignalEvaluationSnapshot.builder()
                .symbol(symbol.toUpperCase())
                .timestamp(MarketTime.nowLocal())
                .signalType(signalType)
                .lifecycleState(lifecycleState != null ? lifecycleState : "")
                .score(score)
                .passedConditions(String.join("|", passed))
                .failedConditions(String.join("|", failed))
                .price(price)
                .volume(volume)
                .rvol(rvol)
                .vwapState(vwapState != null ? vwapState : "")
                .createdAt(MarketTime.nowLocal())
                .build();
        repository.save(snap);
        log.debug("Replay snapshot {} {} score={} passed={}", symbol, signalType, score, passed.size());
    }

    public void recordFromEval(String symbol, String signalType, int score,
                               Map<String, Boolean> conditions, BigDecimal price,
                               Long volume, BigDecimal rvol, boolean aboveVwap) {
        String vwapState = aboveVwap ? "ABOVE" : "BELOW";
        String lifecycle = score >= 6 ? SignalLifecycleState.ACTIVE
                : score >= 4 ? SignalLifecycleState.NEW : SignalLifecycleState.WEAKENING;
        record(symbol, signalType, lifecycle, score, conditions, price, volume, rvol, vwapState);
    }

    public static Map<String, Boolean> mergeConditions(Map<String, Boolean> base, String key, boolean value) {
        Map<String, Boolean> merged = new LinkedHashMap<>(base != null ? base : Map.of());
        merged.put(key, value);
        return merged;
    }

    public List<SignalEvaluationSnapshot> timeline(String symbol, LocalDateTime since) {
        return repository.findBySymbolAndTimestampAfterOrderByTimestampAsc(symbol.toUpperCase(), since);
    }
}
