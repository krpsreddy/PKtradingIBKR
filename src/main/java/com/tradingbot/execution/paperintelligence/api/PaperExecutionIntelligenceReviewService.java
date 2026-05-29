package com.tradingbot.execution.paperintelligence.api;

import com.tradingbot.execution.paperintelligence.telemetry.ContinuationCaptureAnalyticsEngine;
import com.tradingbot.models.ExecutionTelemetryRecord;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.repository.ExecutionTelemetryRepository;
import com.tradingbot.repository.PaperExecutionRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaperExecutionIntelligenceReviewService {

    private final ExecutionTelemetryRepository telemetryRepository;
    private final PaperExecutionRecordRepository paperRepository;
    private final ContinuationCaptureAnalyticsEngine captureAnalytics;

    public PaperExecutionIntelligenceDtos.ExecutionReviewSummaryDto review() {
        List<ExecutionTelemetryRecord> closed = telemetryRepository
                .findTop200ByClosedAtNotNullOrderByClosedAtDesc();
        if (closed.isEmpty()) {
            return new PaperExecutionIntelligenceDtos.ExecutionReviewSummaryDto(
                    0, 0, 0, 0, 0, List.of("No closed paper telemetry yet"));
        }
        double avgCap = closed.stream()
                .filter(t -> t.getContinuationCapturePct() != null)
                .mapToDouble(t -> t.getContinuationCapturePct().doubleValue())
                .average().orElse(0);
        double avgSlip = closed.stream()
                .filter(t -> t.getSlippagePct() != null)
                .mapToDouble(t -> t.getSlippagePct().doubleValue())
                .average().orElse(0);
        long premature = closed.stream().filter(t -> Boolean.TRUE.equals(t.getPrematureExit())).count();
        double premPct = closed.isEmpty() ? 0 : premature * 100.0 / closed.size();
        double avgScore = closed.stream()
                .filter(t -> t.getExecutionScore() != null)
                .mapToInt(ExecutionTelemetryRecord::getExecutionScore)
                .average().orElse(0);

        List<String> insights = new ArrayList<>();
        insights.add(String.format(Locale.US, "%d closed trades · avg capture %.0f%%", closed.size(), avgCap));
        if (premPct > 25) insights.add("High premature exit rate — widen structural trail");
        if (avgSlip > 0.25) insights.add("Elevated slippage — reduce parabolic entries");

        return new PaperExecutionIntelligenceDtos.ExecutionReviewSummaryDto(
                closed.size(), avgCap, avgSlip, premPct, avgScore, insights);
    }

    public List<PaperExecutionIntelligenceDtos.TrailingAnalysisDto> trailingAnalysis() {
        return telemetryRepository.findByClosedAtNotNullOrderByClosedAtDesc().stream()
                .limit(50)
                .map(t -> new PaperExecutionIntelligenceDtos.TrailingAnalysisDto(
                        t.getSymbol(),
                        t.getTrailingState(),
                        null,
                        t.getDeteriorationState(),
                        0))
                .toList();
    }

    public PaperExecutionIntelligenceDtos.SlippageAnalysisDto slippageAnalysis() {
        var rows = telemetryRepository.findTop200ByClosedAtNotNullOrderByClosedAtDesc().stream()
                .filter(t -> t.getSlippagePct() != null)
                .map(t -> new PaperExecutionIntelligenceDtos.FillQualityRowDto(
                        t.getSymbol(), t.getFillQuality(), t.getFillLatencyMs(),
                        t.getSlippagePct(), t.getFillProbability()))
                .toList();
        double avg = rows.stream().mapToDouble(r -> r.slippagePct().doubleValue()).average().orElse(0);
        int poor = (int) rows.stream().filter(r -> "POOR".equals(r.fillQuality()) || "MISSED".equals(r.fillQuality())).count();
        return new PaperExecutionIntelligenceDtos.SlippageAnalysisDto(avg, poor,
                rows.stream().limit(10).toList());
    }

    public PaperExecutionIntelligenceDtos.ContinuationCaptureDto continuationCapture() {
        List<ExecutionTelemetryRecord> closed = telemetryRepository
                .findTop200ByClosedAtNotNullOrderByClosedAtDesc();
        Map<String, List<ExecutionTelemetryRecord>> byLifecycle = closed.stream()
                .filter(t -> t.getLifecycle() != null)
                .collect(Collectors.groupingBy(ExecutionTelemetryRecord::getLifecycle));

        List<String> insights = new ArrayList<>();
        byLifecycle.forEach((lc, list) -> {
            double avg = list.stream()
                    .filter(t -> t.getContinuationCapturePct() != null)
                    .mapToDouble(t -> t.getContinuationCapturePct().doubleValue())
                    .average().orElse(0);
            insights.add(lc + " avg capture " + String.format(Locale.US, "%.0f%%", avg));
        });

        long prem = closed.stream().filter(t -> Boolean.TRUE.equals(t.getPrematureExit())).count();
        long over = closed.stream().filter(t -> Boolean.TRUE.equals(t.getOverstayedTrade())).count();
        double avgCap = closed.stream()
                .filter(t -> t.getContinuationCapturePct() != null)
                .mapToDouble(t -> t.getContinuationCapturePct().doubleValue())
                .average().orElse(0);

        return new PaperExecutionIntelligenceDtos.ContinuationCaptureDto(avgCap, (int) prem, (int) over, insights);
    }

    public List<PaperExecutionIntelligenceDtos.PrematureExitRowDto> prematureExits() {
        return telemetryRepository.findTop200ByClosedAtNotNullOrderByClosedAtDesc().stream()
                .filter(t -> Boolean.TRUE.equals(t.getPrematureExit()))
                .limit(30)
                .map(t -> {
                    PaperExecutionRecord p = paperRepository.findById(t.getPaperExecutionId()).orElse(null);
                    return new PaperExecutionIntelligenceDtos.PrematureExitRowDto(
                            t.getSymbol(),
                            t.getRegime(),
                            t.getMfeR(),
                            t.getRealizedR(),
                            t.getContinuationCapturePct(),
                            t.getExitReason());
                })
                .toList();
    }

    public List<PaperExecutionIntelligenceDtos.FillQualityRowDto> fillQuality() {
        return telemetryRepository.findTop200ByClosedAtNotNullOrderByClosedAtDesc().stream()
                .limit(40)
                .map(t -> new PaperExecutionIntelligenceDtos.FillQualityRowDto(
                        t.getSymbol(), t.getFillQuality(), t.getFillLatencyMs(),
                        t.getSlippagePct(), t.getFillProbability()))
                .toList();
    }
}
