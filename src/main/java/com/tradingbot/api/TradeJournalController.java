package com.tradingbot.api;

import com.tradingbot.api.dto.CreateTradeJournalRequest;
import com.tradingbot.api.dto.TradeJournalEntryDto;
import com.tradingbot.services.TradeJournalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/journal")
@RequiredArgsConstructor
public class TradeJournalController {

    private final TradeJournalService tradeJournalService;

    @GetMapping
    public List<TradeJournalEntryDto> list(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String setupType) {
        if (symbol != null && !symbol.isBlank()) {
            return tradeJournalService.listBySymbol(symbol.toUpperCase());
        }
        if (setupType != null && !setupType.isBlank()) {
            return tradeJournalService.listBySetupType(setupType);
        }
        return tradeJournalService.listAll();
    }

    @PostMapping
    public TradeJournalEntryDto create(@RequestBody CreateTradeJournalRequest request) {
        return tradeJournalService.create(request);
    }

    @PutMapping("/{id}")
    public TradeJournalEntryDto update(@PathVariable Long id, @RequestBody CreateTradeJournalRequest request) {
        return tradeJournalService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        tradeJournalService.delete(id);
    }
}
