package com.tradingbot.replay.cache;

import com.tradingbot.api.dto.BulkReplayHistoryDto;
import com.tradingbot.api.dto.ReplayHistoryDto;
import com.tradingbot.replay.cache.dto.ReplayCacheDtos.IncrementalReplayResultDto;
import com.tradingbot.replay.cache.dto.ReplayCacheDtos.StaleSessionsDto;
import com.tradingbot.replay.cache.dto.ReplayCacheDtos.SymbolSnapshotPageDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/replay-cache")
@RequiredArgsConstructor
public class ReplayCacheController {

    private final ReplayCacheQueryService queryService;
    private final IncrementalReplayService incrementalReplayService;
    private final ReplaySnapshotService snapshotService;
    private final ReplaySignalIndexService signalIndexService;

    @GetMapping("/snapshot/{symbol}")
    public SymbolSnapshotPageDto snapshotSummary(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "60") int days) {
        return queryService.snapshotSummary(symbol, days);
    }

    @GetMapping("/snapshot/{symbol}/{sessionDate}")
    public ReplayHistoryDto sessionSnapshot(
            @PathVariable String symbol,
            @PathVariable String sessionDate) {
        return snapshotService.loadSession(symbol.toUpperCase(), LocalDate.parse(sessionDate))
                .orElse(null);
    }

    @GetMapping("/sessions/{symbol}")
    public List<ReplayHistoryDto> readySessions(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "60") int days) {
        int window = days > 0 ? days : 60;
        var cutoff = java.time.LocalDate.now().minusDays(window);
        return snapshotService.loadReadySessions(symbol.toUpperCase(), cutoff);
    }

    @GetMapping("/session-summary/{symbol}")
    public List<com.tradingbot.replay.cache.dto.ReplayCacheDtos.SessionSummaryDto> sessionSummary(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "60") int days) {
        int window = days > 0 ? days : 60;
        var cutoff = java.time.LocalDate.now().minusDays(window);
        return snapshotService.sessionSummaries(symbol.toUpperCase(), cutoff);
    }

    /** Phase 155 — compact cross-session signal index (loads snapshots only on click). */
    @GetMapping("/signal-index/{symbol}")
    public com.tradingbot.replay.cache.dto.ReplayCacheDtos.ReplaySignalIndexPageDto signalIndex(
            @PathVariable String symbol,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String decision,
            @RequestParam(required = false) String narrative,
            @RequestParam(required = false) String quality,
            @RequestParam(required = false) String result,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "500") int size
    ) {
        java.time.LocalDate fromDate = from != null && !from.isBlank() ? java.time.LocalDate.parse(from) : null;
        java.time.LocalDate toDate = to != null && !to.isBlank() ? java.time.LocalDate.parse(to) : null;
        return signalIndexService.index(symbol, fromDate, toDate, decision, narrative, quality, result, page, size);
    }

    @GetMapping("/stale-sessions/{symbol}")
    public StaleSessionsDto staleSessions(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "60") int days) {
        return incrementalReplayService.staleSessions(symbol, days);
    }

    @PostMapping("/incremental-replay/{symbol}")
    public BulkReplayHistoryDto incrementalReplay(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "60") int days,
            @RequestParam(required = false, defaultValue = "5MIN") String timeframe,
            @RequestParam(defaultValue = "false") boolean force) {
        IncrementalReplayResultDto result = incrementalReplayService.incrementalReplay(
                symbol, days, timeframe, force);
        return incrementalReplayService.toBulkDto(result);
    }
}
