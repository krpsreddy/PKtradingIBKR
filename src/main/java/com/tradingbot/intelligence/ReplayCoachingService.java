package com.tradingbot.intelligence;

import com.tradingbot.api.dto.ReplayCoachingDto;
import com.tradingbot.intelligence.dto.ExecutionIntelligenceDto;
import com.tradingbot.intelligence.dto.SymbolIntelligenceDto;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.repository.TradingSignalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReplayCoachingService {

    private final IntradayIntelligenceService intradayIntelligenceService;
    private final IntelligenceEnrichmentService enrichmentService;
    private final TradingSignalRepository signalRepository;

    public ReplayCoachingDto coach(String symbol) {
        String sym = symbol.toUpperCase();
        TradingSignal latest = signalRepository.findBySymbolOrderByTimestampDesc(sym).stream().findFirst().orElse(null);
        SymbolIntelligenceDto intel = enrichmentService.analyze(sym, latest);
        ExecutionIntelligenceDto exec = intel.getExecution();

        List<String> ideal = new ArrayList<>();
        List<String> dangerous = new ArrayList<>();
        List<String> lessons = new ArrayList<>();

        if (exec != null && exec.getTradeQuality() != null) {
            String grade = exec.getTradeQuality().getGrade();
            if ("A+".equals(grade) || "A".equals(grade)) {
                ideal.add("Entry quality aligned with strong trade grade (" + grade + ")");
            }
            if (exec.getNoEdge() != null && exec.getNoEdge().isNoEdge()) {
                dangerous.add("No-edge conditions present — ideal action: wait");
            }
            if (exec.getWhyNotReasons() != null) {
                dangerous.addAll(exec.getWhyNotReasons());
            }
            if (exec.getDeterioration() != null && !"STABLE".equals(exec.getDeterioration().getState())) {
                lessons.add("Setup deteriorated: " + String.join(", ", exec.getDeterioration().getReasons()));
            }
        }

        if (ideal.isEmpty()) ideal.add("Wait for FRESH signal with strong MTF alignment");
        if (lessons.isEmpty()) lessons.add("Review whether entry matched playbook conditions");

        return ReplayCoachingDto.builder()
                .symbol(sym)
                .idealActions(ideal)
                .dangerousSignals(dangerous.stream().distinct().toList())
                .lessons(lessons)
                .build();
    }
}
