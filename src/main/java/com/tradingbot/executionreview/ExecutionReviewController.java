package com.tradingbot.executionreview;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Phase 190 — post-market execution review APIs (Angular research platform). */
@RestController
@RequestMapping("/api/execution-review")
@RequiredArgsConstructor
public class ExecutionReviewController {

    private final ExecutionReviewService reviewService;

    @GetMapping("/daily-summary")
    public ExecutionReviewDtos.DailySummaryDto dailySummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return reviewService.dailySummary(date);
    }

    @GetMapping("/trades")
    public ExecutionReviewDtos.TradesResponseDto trades(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String regime,
            @RequestParam(required = false) String lifecycle,
            @RequestParam(required = false) String outcome,
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String sessionPeriod,
            @RequestParam(required = false) String entryQuality,
            @RequestParam(required = false) String exitQuality
    ) {
        return reviewService.trades(date, regime, lifecycle, outcome, symbol,
                sessionPeriod, entryQuality, exitQuality);
    }

    @GetMapping("/regime-performance")
    public List<ExecutionReviewDtos.RegimePerformanceDto> regimePerformance(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return reviewService.regimePerformance(date);
    }

    @GetMapping("/continuation-capture")
    public List<ExecutionReviewDtos.ContinuationCaptureDto> continuationCapture(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return reviewService.continuationCapture(date);
    }

    @GetMapping("/queue-analysis")
    public ExecutionReviewDtos.QueueAnalysisDto queueAnalysis(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return reviewService.queueAnalysis(date);
    }

    @GetMapping("/session-analysis")
    public List<ExecutionReviewDtos.SessionAnalysisDto> sessionAnalysis(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return reviewService.sessionAnalysis(date);
    }
}
