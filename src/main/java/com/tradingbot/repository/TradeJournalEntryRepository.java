package com.tradingbot.repository;

import com.tradingbot.models.TradeJournalEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TradeJournalEntryRepository extends JpaRepository<TradeJournalEntry, Long> {
    List<TradeJournalEntry> findBySymbolOrderByEntryTimestampDesc(String symbol);
    List<TradeJournalEntry> findAllByOrderByEntryTimestampDesc();
    List<TradeJournalEntry> findBySetupTypeOrderByEntryTimestampDesc(String setupType);
}
