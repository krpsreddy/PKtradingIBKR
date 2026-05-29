package com.tradingbot.execution.paperintelligence.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Phase 210 — paper execution intelligence review APIs. */
@RestController
@RequestMapping("/api/execution")
@RequiredArgsConstructor
public class PaperExecutionIntelligenceController {

    private final PaperExecutionIntelligenceReviewService reviewService;

    @GetMapping("/review")
    public PaperExecutionIntelligenceDtos.ExecutionReviewSummaryDto review() {
        return reviewService.review();
    }

    @GetMapping("/trailing-analysis")
    public List<PaperExecutionIntelligenceDtos.TrailingAnalysisDto> trailingAnalysis() {
        return reviewService.trailingAnalysis();
    }

    @GetMapping("/fill-quality")
    public List<PaperExecutionIntelligenceDtos.FillQualityRowDto> fillQuality() {
        return reviewService.fillQuality();
    }

    @GetMapping("/slippage-analysis")
    public PaperExecutionIntelligenceDtos.SlippageAnalysisDto slippageAnalysis() {
        return reviewService.slippageAnalysis();
    }

    @GetMapping("/continuation-capture")
    public PaperExecutionIntelligenceDtos.ContinuationCaptureDto continuationCapture() {
        return reviewService.continuationCapture();
    }

    @GetMapping("/premature-exits")
    public List<PaperExecutionIntelligenceDtos.PrematureExitRowDto> prematureExits() {
        return reviewService.prematureExits();
    }
}
