package com.tradingbot.quotes;

import com.tradingbot.quotes.LiveQuoteDtos.QuoteDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/** Batched lightweight quotes for visible UI symbols only. */
@RestController
@RequestMapping("/api/quotes")
@RequiredArgsConstructor
public class LiveQuoteController {

    private final LiveQuoteService liveQuoteService;

    @GetMapping
    public Map<String, QuoteDto> quotes(@RequestParam String symbols) {
        List<String> list = Arrays.stream(symbols.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .limit(32)
                .toList();
        return liveQuoteService.getQuotes(list);
    }
}
