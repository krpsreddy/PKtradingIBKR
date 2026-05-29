package com.tradingbot.api;

import com.tradingbot.api.dto.BulkWatchlistImportRequest;
import com.tradingbot.api.dto.BulkWatchlistImportResult;
import com.tradingbot.api.dto.CreateTradingSymbolRequest;
import com.tradingbot.api.dto.SymbolEnrichRequest;
import com.tradingbot.api.dto.SymbolReorderRequest;
import com.tradingbot.api.dto.TradingSymbolDto;
import com.tradingbot.api.dto.UpdateTradingSymbolRequest;
import com.tradingbot.models.TradingSymbol;
import com.tradingbot.services.TradingSymbolService;
import com.tradingbot.historical.CandleHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/symbols")
@RequiredArgsConstructor
public class TradingSymbolController {

    private final TradingSymbolService tradingSymbolService;
    private final DashboardService dashboardService;
    private final CandleHistoryService candleHistoryService;

    @GetMapping
    public List<TradingSymbolDto> listSymbols(@RequestParam(defaultValue = "false") boolean enrich) {
        if (enrich) {
            return dashboardService.getEnrichedSymbols();
        }
        return tradingSymbolService.findAllConfigured().stream()
                .map(tradingSymbolService::toDto)
                .toList();
    }

    /** Progressive enrich — client batches visible symbols (max 8 per call). */
    @PostMapping("/enrich")
    public List<TradingSymbolDto> enrichBatch(@RequestBody SymbolEnrichRequest request) {
        return dashboardService.enrichSymbolsBatch(request);
    }

    /** GET fallback for dev proxies/ngrok that block POST bodies. */
    @GetMapping("/enrich")
    public List<TradingSymbolDto> enrichBatchGet(@RequestParam("symbols") List<String> symbols) {
        SymbolEnrichRequest request = new SymbolEnrichRequest();
        request.setSymbols(symbols);
        return dashboardService.enrichSymbolsBatch(request);
    }

    @PostMapping
    public TradingSymbolDto createSymbol(@RequestBody CreateTradingSymbolRequest request) {
        TradingSymbol row = tradingSymbolService.createSymbol(request);
        return dashboardService.enrichSymbol(row);
    }

    /** One-shot bulk watchlist load — idempotent, de-duplicates symbols. */
    @PostMapping("/bulk-watchlist")
    public BulkWatchlistImportResult bulkWatchlist(@RequestBody BulkWatchlistImportRequest request) {
        return tradingSymbolService.bulkImportWatchlist(
                request.getSymbols(),
                request.getGroupName(),
                request.getScanEnabled(),
                request.getSubscribeLive(),
                request.getPreloadOnStartup());
    }

    @PutMapping("/{symbol}")
    public TradingSymbolDto updateSymbol(@PathVariable String symbol,
                                         @RequestBody UpdateTradingSymbolRequest request) {
        TradingSymbol row = tradingSymbolService.updateSymbol(symbol.toUpperCase(), request);
        return dashboardService.enrichSymbol(row);
    }

    @DeleteMapping("/{symbol}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSymbol(@PathVariable String symbol) {
        tradingSymbolService.softDelete(symbol.toUpperCase());
    }

    @PostMapping("/{symbol}/watchlist")
    public TradingSymbolDto addToWatchlist(@PathVariable String symbol) {
        TradingSymbol row = tradingSymbolService.addToWatchlist(symbol.toUpperCase());
        return dashboardService.enrichSymbol(row);
    }

    @DeleteMapping("/{symbol}/watchlist")
    public TradingSymbolDto removeFromWatchlist(@PathVariable String symbol) {
        TradingSymbol row = tradingSymbolService.removeFromWatchlist(symbol.toUpperCase());
        return dashboardService.enrichSymbol(row);
    }

    @PostMapping("/{symbol}/toggle-scan")
    public TradingSymbolDto toggleScan(@PathVariable String symbol) {
        TradingSymbol row = tradingSymbolService.toggleScan(symbol.toUpperCase());
        return dashboardService.enrichSymbol(row);
    }

    @PostMapping("/{symbol}/toggle-live")
    public TradingSymbolDto toggleLive(@PathVariable String symbol) {
        TradingSymbol row = tradingSymbolService.toggleLive(symbol.toUpperCase());
        return dashboardService.enrichSymbol(row);
    }

    @PostMapping("/{symbol}/view")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordView(@PathVariable String symbol) {
        tradingSymbolService.recordLastViewed(symbol.toUpperCase());
    }

    /** GET fallback — ngrok/browser sometimes blocks POST without cached basic auth. */
    @GetMapping("/{symbol}/view")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordViewGet(@PathVariable String symbol) {
        tradingSymbolService.recordLastViewed(symbol.toUpperCase());
    }

    @PostMapping("/reorder")
    public List<TradingSymbolDto> reorder(@RequestBody SymbolReorderRequest request) {
        return tradingSymbolService.reorder(request).stream()
                .map(tradingSymbolService::toDto)
                .toList();
    }

    /** Phase 135 — stored candle coverage for incremental hydration planning. */
    @GetMapping("/{symbol}/history-coverage")
    public com.tradingbot.api.dto.SymbolHistoryCoverageDto historyCoverage(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "60") int days) {
        return candleHistoryService.coverage(symbol, days);
    }
}
