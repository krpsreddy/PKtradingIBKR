package com.tradingbot.paper;

import com.tradingbot.api.dto.PaperExecutionDtos;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.repository.PaperExecutionRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PaperExecutionAnalyticsService {

    private final PaperExecutionRecordRepository repository;

    public PaperExecutionDtos.ExecutionAnalyticsDto buildAnalytics() {
        List<PaperExecutionRecord> all = repository.findAllByOrderBySubmittedAtDesc();
        Map<String, PaperExecutionDtos.RegimeStatsDto> byRegime = new LinkedHashMap<>();
        int open = 0;
        int closed = 0;
        int blocked = 0;
        BigDecimal slipSum = BigDecimal.ZERO;
        int slipN = 0;
        BigDecimal rSum = BigDecimal.ZERO;
        int rN = 0;
        BigDecimal mfeSum = BigDecimal.ZERO;
        int mfeN = 0;
        BigDecimal maeSum = BigDecimal.ZERO;
        int maeN = 0;

        for (PaperExecutionRecord r : all) {
            if (r.getStatus() == PaperExecutionStatus.BLOCKED) {
                blocked++;
                continue;
            }
            if (r.getStatus() == PaperExecutionStatus.CLOSED) {
                closed++;
            } else if (r.getStatus() == PaperExecutionStatus.OPEN
                    || r.getStatus() == PaperExecutionStatus.FILLED
                    || r.getStatus() == PaperExecutionStatus.SUBMITTED) {
                open++;
            }
            if (r.getSlippage() != null) {
                slipSum = slipSum.add(r.getSlippage());
                slipN++;
            }
            if (r.getRealizedR() != null) {
                rSum = rSum.add(r.getRealizedR());
                rN++;
            }
            if (r.getMfeR() != null) {
                mfeSum = mfeSum.add(r.getMfeR());
                mfeN++;
            }
            if (r.getMaeR() != null) {
                maeSum = maeSum.add(r.getMaeR());
                maeN++;
            }
            String regime = r.getRegime() != null ? r.getRegime() : "UNKNOWN";
            PaperExecutionDtos.RegimeStatsDto prev = byRegime.get(regime);
            if (prev == null) {
                byRegime.put(regime, RegimeStatsBuilder.start(regime, r));
            } else {
                byRegime.put(regime, RegimeStatsBuilder.add(prev, r));
            }
        }

        return PaperExecutionDtos.ExecutionAnalyticsDto.builder()
                .totalProbes(all.size())
                .openCount(open)
                .closedCount(closed)
                .blockedCount(blocked)
                .byRegime(byRegime)
                .avgSlippage(avg(slipSum, slipN))
                .avgRealizedR(avg(rSum, rN))
                .avgMfeR(avg(mfeSum, mfeN))
                .avgMaeR(avg(maeSum, maeN))
                .build();
    }

    private static BigDecimal avg(BigDecimal sum, int n) {
        if (n == 0) return null;
        return sum.divide(BigDecimal.valueOf(n), 4, RoundingMode.HALF_UP);
    }

    private static final class RegimeStatsBuilder {
        static PaperExecutionDtos.RegimeStatsDto start(String regime, PaperExecutionRecord r) {
            return add(PaperExecutionDtos.RegimeStatsDto.builder()
                    .regime(regime)
                    .count(0)
                    .closed(0)
                    .avgRealizedR(null)
                    .avgMfeR(null)
                    .avgMaeR(null)
                    .continuationSurvivalCount(0)
                    .build(), r);
        }

        static PaperExecutionDtos.RegimeStatsDto add(PaperExecutionDtos.RegimeStatsDto prev, PaperExecutionRecord r) {
            int count = prev.getCount() + 1;
            int closed = prev.getClosed() + (r.getStatus() == PaperExecutionStatus.CLOSED ? 1 : 0);
            int surv = prev.getContinuationSurvivalCount()
                    + (Boolean.TRUE.equals(r.getContinuationSurvival()) ? 1 : 0);
            return PaperExecutionDtos.RegimeStatsDto.builder()
                    .regime(prev.getRegime())
                    .count(count)
                    .closed(closed)
                    .avgRealizedR(rollingAvg(prev.getAvgRealizedR(), prev.getCount(), r.getRealizedR()))
                    .avgMfeR(rollingAvg(prev.getAvgMfeR(), prev.getCount(), r.getMfeR()))
                    .avgMaeR(rollingAvg(prev.getAvgMaeR(), prev.getCount(), r.getMaeR()))
                    .continuationSurvivalCount(surv)
                    .build();
        }

        private static BigDecimal rollingAvg(BigDecimal prevAvg, int prevCount, BigDecimal next) {
            if (next == null) return prevAvg;
            if (prevAvg == null || prevCount == 0) return next;
            return prevAvg.multiply(BigDecimal.valueOf(prevCount))
                    .add(next)
                    .divide(BigDecimal.valueOf(prevCount + 1), 4, RoundingMode.HALF_UP);
        }
    }
}
