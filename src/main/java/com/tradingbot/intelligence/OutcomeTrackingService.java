package com.tradingbot.intelligence;

import com.tradingbot.models.SignalOutcome;
import com.tradingbot.models.TradeJournalEntry;
import com.tradingbot.repository.SignalOutcomeRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OutcomeTrackingService {

    private final SignalOutcomeRepository repository;

    @Transactional
    public SignalOutcome record(SignalOutcome outcome) {
        if (outcome.getRecordedAt() == null) outcome.setRecordedAt(MarketTime.nowLocal());
        if (outcome.getSessionDate() == null) outcome.setSessionDate(outcome.getRecordedAt().toLocalDate());
        return repository.save(outcome);
    }

    @Transactional
    public SignalOutcome fromJournal(TradeJournalEntry journal) {
        String outcome = mapResult(journal.getResult());
        LocalDateTime ts = journal.getEntryTimestamp() != null ? journal.getEntryTimestamp() : MarketTime.nowLocal();
        return record(SignalOutcome.builder()
                .symbol(journal.getSymbol())
                .signalType(journal.getSignalType())
                .setupType(journal.getSetupType())
                .tradeQualityGrade(journal.getTradeQualityGrade())
                .outcome(outcome)
                .rrAchieved(journal.getRrAchieved())
                .entryPrice(journal.getEntryPrice())
                .exitPrice(journal.getExitPrice())
                .recordedAt(ts)
                .sessionDate(ts.toLocalDate())
                .timeOfDay(timeBucket(ts))
                .build());
    }

    public List<SignalOutcome> todayOutcomes() {
        return repository.findBySessionDateOrderByRecordedAtDesc(MarketTime.nowLocal().toLocalDate());
    }

    public List<SignalOutcome> recent(int days) {
        LocalDate since = MarketTime.nowLocal().toLocalDate().minusDays(days);
        return repository.findSince(since);
    }

    private static String mapResult(String result) {
        if (result == null) return "NEUTRAL";
        String r = result.toUpperCase();
        if (r.contains("WIN") || r.contains("PROFIT")) return "WIN";
        if (r.contains("LOSS") || r.contains("FAIL")) return "LOSS";
        return "NEUTRAL";
    }

    static String timeBucket(LocalDateTime ts) {
        int hour = ts.getHour();
        if (hour < 10) return "OPEN";
        if (hour < 12) return "MID_MORNING";
        if (hour < 14) return "MIDDAY";
        return "AFTERNOON";
    }
}
