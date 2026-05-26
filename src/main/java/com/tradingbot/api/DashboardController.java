package com.tradingbot.api;

import com.tradingbot.api.dto.ActiveSignalDto;
import com.tradingbot.api.dto.CandleChartDto;
import com.tradingbot.api.dto.DebugDto;
import com.tradingbot.api.dto.IndicatorDto;
import com.tradingbot.api.dto.SignalDto;
import com.tradingbot.api.dto.SystemStatusDto;
import com.tradingbot.api.dto.WatchlistItemDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tradingbot.replay.HistoricalReplayEngine;

import com.tradingbot.api.dto.HotMomentumDto;
import com.tradingbot.api.dto.MomPullDebugDto;
import com.tradingbot.api.dto.OpenFailDebugDto;
import com.tradingbot.api.dto.OpenMomentumDebugDto;
import com.tradingbot.api.dto.OpenScoutDebugDto;
import com.tradingbot.api.dto.OpeningMomentumDto;
import com.tradingbot.api.dto.ReplayEventDto;
import com.tradingbot.api.dto.BulkReplayHistoryDto;
import com.tradingbot.api.dto.ReplayHistoryDto;
import com.tradingbot.api.dto.RecoveryFailDebugDto;
import com.tradingbot.api.dto.SignalHealthDto;
import com.tradingbot.api.dto.EmergingSetupItemDto;
import com.tradingbot.api.dto.ExecutionSnapshotDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.SymbolSubscribeDto;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final HistoricalReplayEngine historicalReplayEngine;

    @GetMapping("/candles/latest")
    public List<CandleChartDto> latestCandles() {
        return dashboardService.getLatestCandles();
    }

    @GetMapping("/candles/{symbol}")
    public List<CandleChartDto> candlesForSymbol(@PathVariable String symbol) {
        return dashboardService.getLatestCandles(symbol.toUpperCase());
    }

    @GetMapping("/indicators/latest")
    public IndicatorDto latestIndicators() {
        return dashboardService.getLatestIndicators();
    }

    @GetMapping("/indicators/{symbol}")
    public IndicatorDto indicatorsForSymbol(@PathVariable String symbol) {
        return dashboardService.getLatestIndicators(symbol.toUpperCase());
    }

    @GetMapping("/signals/latest")
    public List<SignalDto> latestSignals() {
        return dashboardService.getLatestSignals();
    }

    @GetMapping("/signals/active")
    public List<ActiveSignalDto> activeSignals() {
        return dashboardService.getActiveSignals();
    }

    @GetMapping("/momentum/hot")
    public List<HotMomentumDto> hotMomentum() {
        return dashboardService.getHotMomentum();
    }

    @GetMapping("/momentum/opening")
    public List<OpeningMomentumDto> openingMomentum() {
        return dashboardService.getOpeningMomentum();
    }

    @GetMapping("/debug/open-mom/{symbol}")
    public OpenMomentumDebugDto openMomentumDebug(@PathVariable String symbol) {
        return dashboardService.getOpenMomentumDebug(symbol.toUpperCase());
    }

    @GetMapping("/debug/open-scout/{symbol}")
    public OpenScoutDebugDto openScoutDebug(@PathVariable String symbol) {
        return dashboardService.getOpenScoutDebug(symbol.toUpperCase());
    }

    @GetMapping("/debug/open-fail/{symbol}")
    public OpenFailDebugDto openFailDebug(@PathVariable String symbol) {
        return dashboardService.getOpenFailDebug(symbol.toUpperCase());
    }

    @GetMapping("/debug/recovery-fail/{symbol}")
    public RecoveryFailDebugDto recoveryFailDebug(@PathVariable String symbol) {
        return dashboardService.getRecoveryFailDebug(symbol.toUpperCase());
    }

    @GetMapping("/debug/mom-pull/{symbol}")
    public MomPullDebugDto momPullDebug(@PathVariable String symbol) {
        return dashboardService.getMomPullDebug(symbol.toUpperCase());
    }

    @GetMapping("/replay/{symbol}")
    public List<ReplayEventDto> replayTimeline(@PathVariable String symbol) {
        return dashboardService.getReplayTimeline(symbol.toUpperCase());
    }

    @GetMapping("/replay/history/{symbol}")
    public ReplayHistoryDto replayHistory(
            @PathVariable String symbol,
            @RequestParam(required = false) String date,
            @RequestParam(required = false, defaultValue = "5MIN") String timeframe) {
        return historicalReplayEngine.replay(
                symbol.toUpperCase(),
                historicalReplayEngine.parseDate(date),
                timeframe);
    }

    /** Bulk replay all stored sessions in lookback window — feeds Signal Intelligence backfill. */
    @GetMapping("/replay/bulk/{symbol}")
    public BulkReplayHistoryDto replayBulk(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "60") int days,
            @RequestParam(required = false, defaultValue = "5MIN") String timeframe) {
        return historicalReplayEngine.bulkReplay(symbol.toUpperCase(), days, timeframe);
    }

    @GetMapping("/momentum/failed")
    public List<HotMomentumDto> failedMomentum() {
        return dashboardService.getFailedMomentum();
    }

    @GetMapping("/momentum/continuation")
    public List<HotMomentumDto> continuationSetups() {
        return dashboardService.getContinuationSetups();
    }

    @GetMapping("/setups/emerging")
    public List<EmergingSetupItemDto> emergingSetups() {
        return dashboardService.getEmergingSetups();
    }

    @GetMapping("/execution/{symbol}")
    public ExecutionSnapshotDto executionSnapshot(@PathVariable String symbol) {
        return dashboardService.getExecutionSnapshot(symbol.toUpperCase());
    }

    @GetMapping("/market/trend")
    public MarketTrendDto marketTrend() {
        return dashboardService.getMarketTrend();
    }

    @GetMapping("/signals/{symbol}")
    public List<SignalDto> signalsForSymbol(@PathVariable String symbol) {
        return dashboardService.getLatestSignals(symbol.toUpperCase());
    }

    @GetMapping("/watchlist")
    public List<WatchlistItemDto> watchlist() {
        return dashboardService.getWatchlist();
    }

    @PostMapping("/watchlist/{symbol}")
    public WatchlistItemDto addWatchlistSymbol(@PathVariable String symbol) {
        return dashboardService.addWatchlistSymbol(symbol.toUpperCase());
    }

    @DeleteMapping("/watchlist/{symbol}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeWatchlistSymbol(@PathVariable String symbol) {
        dashboardService.removeWatchlistSymbol(symbol.toUpperCase());
    }

    @PostMapping("/watchlist/{symbol}/view")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordWatchlistView(@PathVariable String symbol) {
        dashboardService.recordWatchlistView(symbol.toUpperCase());
    }

    @PostMapping("/symbols/subscribe/{symbol}")
    public SymbolSubscribeDto subscribeSymbol(@PathVariable String symbol) {
        return dashboardService.subscribeSymbol(symbol.toUpperCase());
    }

    @GetMapping("/system/status")
    public SystemStatusDto systemStatus() {
        return dashboardService.getSystemStatus();
    }

    @GetMapping("/health/signals")
    public SignalHealthDto signalHealth() {
        return dashboardService.getSignalHealth();
    }

    @GetMapping("/debug/panel")
    public DebugDto debugPanel() {
        return dashboardService.getDebugPanel();
    }
}
