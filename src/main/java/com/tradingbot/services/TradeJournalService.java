package com.tradingbot.services;

import com.tradingbot.api.dto.TradeJournalEntryDto;
import com.tradingbot.api.dto.CreateTradeJournalRequest;
import com.tradingbot.models.TradeJournalEntry;
import com.tradingbot.repository.TradeJournalEntryRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TradeJournalService {

    private final TradeJournalEntryRepository repository;

    public List<TradeJournalEntryDto> listAll() {
        return repository.findAllByOrderByEntryTimestampDesc().stream().map(this::toDto).toList();
    }

    public List<TradeJournalEntryDto> listBySymbol(String symbol) {
        return repository.findBySymbolOrderByEntryTimestampDesc(symbol.toUpperCase()).stream()
                .map(this::toDto).toList();
    }

    public List<TradeJournalEntryDto> listBySetupType(String setupType) {
        return repository.findBySetupTypeOrderByEntryTimestampDesc(setupType).stream()
                .map(this::toDto).toList();
    }

    @Transactional
    public TradeJournalEntryDto create(CreateTradeJournalRequest req) {
        TradeJournalEntry entry = TradeJournalEntry.builder()
                .symbol(req.getSymbol().toUpperCase())
                .setupType(req.getSetupType())
                .signalType(req.getSignalType())
                .entryTimestamp(parseTs(req.getEntryTimestamp()))
                .entryPrice(req.getEntryPrice())
                .exitPrice(req.getExitPrice())
                .result(req.getResult())
                .rrAchieved(req.getRrAchieved())
                .screenshotPath(req.getScreenshotPath())
                .replayLink(req.getReplayLink())
                .notes(req.getNotes())
                .emotion(req.getEmotion())
                .mistakes(req.getMistakes())
                .lessons(req.getLessons())
                .tradeQualityGrade(req.getTradeQualityGrade())
                .build();
        return toDto(repository.save(entry));
    }

    @Transactional
    public TradeJournalEntryDto update(Long id, CreateTradeJournalRequest req) {
        TradeJournalEntry entry = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Journal entry not found: " + id));
        entry.setSymbol(req.getSymbol().toUpperCase());
        entry.setSetupType(req.getSetupType());
        entry.setSignalType(req.getSignalType());
        if (req.getEntryTimestamp() != null) entry.setEntryTimestamp(parseTs(req.getEntryTimestamp()));
        entry.setEntryPrice(req.getEntryPrice());
        entry.setExitPrice(req.getExitPrice());
        entry.setResult(req.getResult());
        entry.setRrAchieved(req.getRrAchieved());
        entry.setScreenshotPath(req.getScreenshotPath());
        entry.setReplayLink(req.getReplayLink());
        entry.setNotes(req.getNotes());
        entry.setEmotion(req.getEmotion());
        entry.setMistakes(req.getMistakes());
        entry.setLessons(req.getLessons());
        entry.setTradeQualityGrade(req.getTradeQualityGrade());
        return toDto(repository.save(entry));
    }

    @Transactional
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private TradeJournalEntryDto toDto(TradeJournalEntry e) {
        return TradeJournalEntryDto.builder()
                .id(e.getId())
                .symbol(e.getSymbol())
                .setupType(e.getSetupType())
                .signalType(e.getSignalType())
                .entryTimestamp(e.getEntryTimestamp() != null ? MarketTime.formatIso(e.getEntryTimestamp()) : null)
                .entryPrice(e.getEntryPrice())
                .exitPrice(e.getExitPrice())
                .result(e.getResult())
                .rrAchieved(e.getRrAchieved())
                .screenshotPath(e.getScreenshotPath())
                .replayLink(e.getReplayLink())
                .notes(e.getNotes())
                .emotion(e.getEmotion())
                .mistakes(e.getMistakes())
                .lessons(e.getLessons())
                .tradeQualityGrade(e.getTradeQualityGrade())
                .createdAt(e.getCreatedAt() != null ? MarketTime.formatIso(e.getCreatedAt()) : null)
                .updatedAt(e.getUpdatedAt() != null ? MarketTime.formatIso(e.getUpdatedAt()) : null)
                .build();
    }

    private LocalDateTime parseTs(String iso) {
        if (iso == null || iso.isBlank()) return LocalDateTime.now();
        return LocalDateTime.parse(iso.replace("Z", "").substring(0, Math.min(19, iso.length())));
    }
}
