package com.tradingbot.dataintegrity;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Phase 205 — live data integrity API. */
@RestController
@RequestMapping("/api/live-trader/data-integrity")
@RequiredArgsConstructor
public class DataIntegrityController {

    private final ExecutionSafetyIntegrator integrator;
    private final com.tradingbot.repository.DataIntegrityTelemetryRepository telemetryRepository;

    @GetMapping
    public Map<String, Object> status() {
        DataIntegritySnapshot snap = integrator.snapshot();
        return Map.of(
                "state", snap.state().name(),
                "score", snap.score(),
                "allowsExecution", snap.allowsExecution(),
                "freezeRegimeMutation", snap.freezeRegimeMutation(),
                "dominanceMultiplier", snap.dominanceMultiplier(),
                "stabilizationCandlesRemaining", snap.stabilizationCandlesRemaining(),
                "issues", snap.issues(),
                "assessedAtMs", snap.assessedAtMs()
        );
    }

    @GetMapping("/events")
    public List<Map<String, Object>> recentEvents() {
        return telemetryRepository.findTop50ByOrderByRecordedAtDesc().stream()
                .map(r -> Map.<String, Object>of(
                        "eventType", r.getEventType(),
                        "detail", r.getDetail() != null ? r.getDetail() : "",
                        "state", r.getIntegrityState() != null ? r.getIntegrityState() : "",
                        "score", r.getIntegrityScore() != null ? r.getIntegrityScore() : 0,
                        "recordedAt", r.getRecordedAt().toString()
                ))
                .toList();
    }
}
