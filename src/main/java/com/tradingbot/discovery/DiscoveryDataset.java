package com.tradingbot.discovery;

import com.tradingbot.models.BearishAssistTelemetryRecord;
import com.tradingbot.models.DecisionTraceRecord;
import com.tradingbot.models.ExecutionTelemetryRecord;
import com.tradingbot.models.OrchestrationTelemetryRecord;
import com.tradingbot.models.PaperExecutionRecord;

import java.util.List;
import java.util.Map;

/** In-memory bundle for a lookback window (Phase 203). */
record DiscoveryDataset(
        int days,
        List<ExecutionTelemetryRecord> closedTelemetry,
        List<DecisionTraceRecord> decisionTraces,
        List<OrchestrationTelemetryRecord> orchestration,
        List<BearishAssistTelemetryRecord> bearishTriggers,
        Map<Long, PaperExecutionRecord> paperById,
        Map<Long, String> entryQualityByPaperId,
        Map<Long, String> structureByPaperId,
        Map<Long, String> exitTypeByPaperId
) {}
