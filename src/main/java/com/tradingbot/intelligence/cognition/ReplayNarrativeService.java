package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.cognition.CognitionPartDtos.ReplayNarrativeDto;
import com.tradingbot.intelligence.IntelligenceEnrichmentService;
import com.tradingbot.intelligence.dto.ExecutionIntelligenceDto;
import com.tradingbot.intelligence.dto.SymbolIntelligenceDto;
import com.tradingbot.models.TradingSignal;
import com.tradingbot.repository.TradingSignalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReplayNarrativeService {

    private final IntelligenceEnrichmentService enrichmentService;
    private final TradingSignalRepository signalRepository;

    public ReplayNarrativeDto narrate(String symbol, int replayIndex) {
        String sym = symbol.toUpperCase();
        TradingSignal latest = signalRepository.findBySymbolOrderByTimestampDesc(sym).stream().findFirst().orElse(null);
        SymbolIntelligenceDto intel = enrichmentService.analyze(sym, latest);
        ExecutionIntelligenceDto exec = intel != null ? intel.getExecution() : null;

        List<String> improved = new ArrayList<>();
        List<String> deteriorated = new ArrayList<>();
        List<String> ideal = new ArrayList<>();

        if (exec != null && exec.getDeterioration() != null) {
            if ("STABLE".equals(exec.getDeterioration().getState())) {
                improved.add("Setup quality stable at bar " + replayIndex);
            } else {
                deteriorated.addAll(exec.getDeterioration().getReasons());
            }
        }

        if (intel != null && intel.getExtended() != null && intel.getExtended().isExtended()) {
            deteriorated.add("Price became extended from VWAP");
        }

        if (exec != null && exec.getTradeQuality() != null) {
            String grade = exec.getTradeQuality().getGrade();
            if ("A".equals(grade) || "A+".equals(grade)) {
                ideal.add("Ideal entry zone at current replay point (grade " + grade + ")");
            }
        }

        if (ideal.isEmpty()) ideal.add("Wait for FRESH signal with MTF alignment");

        String narrative = buildNarrative(sym, replayIndex, improved, deteriorated, ideal);

        return ReplayNarrativeDto.builder()
                .symbol(sym)
                .narrative(narrative)
                .improvements(improved)
                .deteriorations(deteriorated)
                .idealEntries(ideal)
                .build();
    }

    private String buildNarrative(String sym, int idx, List<String> imp, List<String> det, List<String> ideal) {
        StringBuilder sb = new StringBuilder();
        sb.append("At bar ").append(idx).append(", ").append(sym).append(" ");
        if (!imp.isEmpty()) sb.append("improved: ").append(String.join("; ", imp)).append(". ");
        if (!det.isEmpty()) sb.append("Deteriorated: ").append(String.join("; ", det)).append(". ");
        sb.append("Ideal entry: ").append(ideal.get(0)).append(".");
        return sb.toString();
    }
}
