package com.tradingbot.api;

import com.tradingbot.api.dto.PaperExecutionDtos;
import com.tradingbot.api.dto.PaperProbeRequest;
import com.tradingbot.config.IBKRProperties;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.paper.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/paper-execution")
@RequiredArgsConstructor
public class PaperExecutionController {

    private final PaperExecutionStateService stateService;
    private final IbkrGatewaySafetyService safetyService;
    private final PaperExecutionResearchService researchService;
    private final PaperExecutionAnalyticsService analyticsService;
    private final IBKRProperties ibkrProperties;
    private final IBKRClientService ibkrClientService;

    @GetMapping("/status")
    public PaperExecutionDtos.ExecutionStatusDto status() {
        PaperExecutionMode mode = stateService.getMode();
        IbkrGatewaySafetyService.SafetyValidation safety = safetyService.validate(mode);
        IbkrGatewayMode gateway = safetyService.resolveGatewayMode();
        return PaperExecutionDtos.ExecutionStatusDto.builder()
                .mode(mode)
                .researchInfrastructureEnabled(stateService.isResearchInfrastructureEnabled())
                .gatewayMode(gateway)
                .configuredIbkrPort(ibkrProperties.getPort())
                .paperPort(ibkrProperties.getPaperPort())
                .livePort(ibkrProperties.getLivePort())
                .ibkrConnected(ibkrClientService.isConnected())
                .ibkrReadyForOrders(ibkrClientService.isReadyForOrders())
                .safety(PaperExecutionDtos.SafetyDto.builder()
                        .allowed(safety.allowed())
                        .reason(safety.reason())
                        .gateway(safety.gateway())
                        .build())
                .build();
    }

    @PutMapping("/mode")
    public PaperExecutionDtos.ExecutionStatusDto setMode(@RequestBody PaperExecutionDtos.SetModeRequest request) {
        if (request == null || request.mode() == null) {
            throw new IllegalArgumentException("mode required");
        }
        stateService.setMode(request.mode());
        return status();
    }

    @PostMapping("/probe")
    public PaperExecutionDtos.PaperExecutionRecordDto submitProbe(@RequestBody PaperProbeRequest request) {
        PaperExecutionRecord record = researchService.submitProbe(request);
        return PaperExecutionDtos.toDto(record);
    }

    @GetMapping("/monitor")
    public PaperExecutionDtos.MonitorSnapshotDto monitor() {
        List<PaperExecutionRecord> activeEntities = researchService.activeRecords();
        List<PaperExecutionDtos.PaperExecutionRecordDto> activeOrders = activeEntities.stream()
                .filter(r -> r.getStatus() == PaperExecutionStatus.SUBMITTED
                        || r.getStatus() == PaperExecutionStatus.PARTIALLY_FILLED)
                .map(PaperExecutionDtos::toDto)
                .toList();
        List<PaperExecutionDtos.PaperExecutionRecordDto> activePositions = activeEntities.stream()
                .filter(r -> r.getStatus() == PaperExecutionStatus.OPEN
                        || r.getStatus() == PaperExecutionStatus.FILLED)
                .map(PaperExecutionDtos::toDto)
                .toList();
        return PaperExecutionDtos.MonitorSnapshotDto.builder()
                .activeOrders(activeOrders)
                .activePositions(activePositions)
                .history(researchService.history().stream().map(PaperExecutionDtos::toDto).toList())
                .analytics(analyticsService.buildAnalytics())
                .build();
    }

    @GetMapping("/active")
    public List<PaperExecutionDtos.PaperExecutionRecordDto> active() {
        return researchService.activeRecords().stream().map(PaperExecutionDtos::toDto).toList();
    }

    @GetMapping("/history")
    public List<PaperExecutionDtos.PaperExecutionRecordDto> history() {
        return researchService.history().stream().map(PaperExecutionDtos::toDto).toList();
    }

    @GetMapping("/analytics")
    public PaperExecutionDtos.ExecutionAnalyticsDto analytics() {
        return analyticsService.buildAnalytics();
    }

    @PostMapping("/{id}/close")
    public PaperExecutionDtos.PaperExecutionRecordDto manualClose(
            @PathVariable Long id,
            @RequestBody(required = false) PaperExecutionDtos.ManualCloseRequest request) {
        var exit = request != null ? request.exitPrice() : null;
        return PaperExecutionDtos.toDto(researchService.markManualClose(id, exit));
    }
}
