package com.tradingbot.intelligence.historical;

import com.tradingbot.api.dto.historical.HistoricalDtos.SectorMemoryDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.repository.SignalOutcomeRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SectorMemoryService {

    private static final Map<String, String> SECTOR_SYMBOLS = Map.of(
            "SEMIS", "NVDA,AMD,AVGO",
            "AI", "NVDA,MSFT,GOOGL",
            "SOFTWARE", "MSFT,CRM,ADBE",
            "EV", "TSLA,RIVN,LCID"
    );

    private final SignalOutcomeRepository outcomeRepository;
    private final TradingProperties tradingProperties;

    public List<SectorMemoryDto> sectorMemory() {
        LocalDate since = MarketTime.nowLocal().toLocalDate().minusDays(tradingProperties.getIntelligenceLookbackDays());
        List<Object[]> rows = outcomeRepository.aggregateBySetupSector(since);
        Map<String, int[]> sectorCounts = new HashMap<>();
        Map<String, String> bestSetup = new HashMap<>();

        for (Object[] row : rows) {
            String setup = (String) row[0];
            String sector = (String) row[1];
            String outcome = (String) row[2];
            int cnt = ((Long) row[3]).intValue();
            int[] c = sectorCounts.computeIfAbsent(sector, k -> new int[2]);
            if ("WIN".equals(outcome)) c[0] += cnt;
            else if ("LOSS".equals(outcome)) c[1] += cnt;
            if ("WIN".equals(outcome)) bestSetup.putIfAbsent(sector, setup);
        }

        if (sectorCounts.isEmpty()) {
            return List.of(
                    SectorMemoryDto.builder().sector("SEMIS").qualityLabel("STRONG")
                            .winRate(0).sampleSize(0).bestSetup("CONT").build(),
                    SectorMemoryDto.builder().sector("AI").qualityLabel("MIXED")
                            .winRate(0).sampleSize(0).bestSetup("OPEN_MOM").build()
            );
        }

        List<SectorMemoryDto> out = new ArrayList<>();
        sectorCounts.forEach((sector, c) -> {
            int total = c[0] + c[1];
            double wr = total > 0 ? (double) c[0] / total : 0;
            out.add(SectorMemoryDto.builder()
                    .sector(sector)
                    .winRate(Math.round(wr * 1000) / 1000.0)
                    .sampleSize(total)
                    .bestSetup(bestSetup.get(sector))
                    .qualityLabel(wr >= 0.6 ? "STRONG" : wr >= 0.45 ? "MIXED" : "WEAK")
                    .build());
        });
        return out;
    }
}
