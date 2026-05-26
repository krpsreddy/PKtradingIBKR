package com.tradingbot.analytics.query;

import com.tradingbot.analytics.query.dto.AnalyticsQueryDtos.BandMetricsDto;
import com.tradingbot.analytics.query.dto.AnalyticsQueryDtos.DiagnosticsInsightDto;
import com.tradingbot.analytics.query.dto.AnalyticsQueryDtos.DiagnosticsSummaryDto;
import com.tradingbot.analytics.query.dto.AnalyticsQueryDtos.GroupStatDto;
import com.tradingbot.analytics.query.model.AnalyticsSignalRow;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Decision, narrative, quality, result stats + diagnostic insights A–J. */
@Component
public class AnalyticsSummaryEngine {

    public List<GroupStatDto> decisionStats(List<AnalyticsSignalRow> rows) {
        return groupStats(rows, AnalyticsSignalRow::decision);
    }

    public List<GroupStatDto> narrativeStats(List<AnalyticsSignalRow> rows) {
        return groupStats(rows, AnalyticsSignalRow::narrative);
    }

    public List<GroupStatDto> qualityStats(List<AnalyticsSignalRow> rows) {
        return groupStats(rows, AnalyticsSignalRow::quality);
    }

    public List<GroupStatDto> resultStats(List<AnalyticsSignalRow> rows) {
        return groupStats(rows, AnalyticsSignalRow::resultBucket);
    }

    public DiagnosticsSummaryDto diagnostics(List<AnalyticsSignalRow> rows, int analyticsVersion) {
        List<DiagnosticsInsightDto> insights = new ArrayList<>();

        int elite = (int) rows.stream().filter(r -> "ELITE".equals(r.convictionBand())).count();
        int fullExec = (int) rows.stream().filter(AnalyticsSignalRow::fullExecution).count();
        int wait = (int) rows.stream().filter(r -> "WAIT".equals(r.decision())).count();
        int avoid = (int) rows.stream().filter(r -> "AVOID".equals(r.decision())).count();
        int enter = (int) rows.stream().filter(r -> "ENTER".equals(r.decision())).count();
        int gt2rLowConv = (int) rows.stream()
                .filter(r -> r.resultR() >= 2.0 && ("LOW".equals(r.convictionBand()) || "AVOID".equals(r.convictionBand())))
                .count();
        int gt2rWait = (int) rows.stream().filter(r -> r.resultR() >= 2.0 && "WAIT".equals(r.decision())).count();
        int gt2rAvoid = (int) rows.stream().filter(r -> r.resultR() >= 2.0 && "AVOID".equals(r.decision())).count();
        int suppressed = (int) rows.stream().filter(AnalyticsSignalRow::suppressedWinner).count();

        insights.add(insight("A", "How many ELITE conviction signals exist?",
                elite + " ELITE signals (" + pct(elite, rows.size()) + "% of total)",
                elite < Math.max(1, rows.size() / 50) ? "WARN" : "OK",
                Map.of("eliteCount", elite, "total", rows.size())));

        insights.add(insight("B", "How many ENTER/ADD actions vs WAIT+AVOID?",
                enter + " ENTER · " + fullExec + " executable vs " + wait + " WATCH + " + avoid + " AVOID",
                fullExec < wait + avoid ? "WARN" : "OK",
                Map.of("enter", enter, "executable", fullExec, "wait", wait, "avoid", avoid)));

        insights.add(insight("C", ">2R moves while conviction LOW or decision WAIT/AVOID?",
                gt2rLowConv + " low-conv >2R · " + gt2rWait + " WAIT >2R · " + gt2rAvoid + " AVOID >2R",
                gt2rWait + gt2rAvoid + gt2rLowConv > 0 ? "WARN" : "OK",
                Map.of("gt2rLowConv", gt2rLowConv, "gt2rWait", gt2rWait, "gt2rAvoid", gt2rAvoid)));

        insights.add(insight("D", "How many continuation winners were suppressed?",
                suppressed + " signals flagged as suppressed winners / false avoid",
                suppressed > rows.size() / 20 ? "WARN" : "OK",
                Map.of("suppressedWinners", suppressed)));

        Map<String, Double> narrativeAvgR = rows.stream()
                .collect(Collectors.groupingBy(AnalyticsSignalRow::narrative,
                        Collectors.averagingDouble(AnalyticsSignalRow::resultR)));
        String topNarrative = narrativeAvgR.entrySet().stream()
                .max(Comparator.comparingDouble(Map.Entry::getValue))
                .map(e -> e.getKey() + " (" + AnalyticsDistributionEngine.round2(e.getValue()) + "R avg)")
                .orElse("—");
        insights.add(insight("E", "Which narratives produce biggest moves?",
                topNarrative,
                "INFO",
                Map.of("narrativeAvgR", narrativeAvgR)));

        List<String> neverFullExec = rows.stream()
                .collect(Collectors.groupingBy(AnalyticsSignalRow::narrative))
                .entrySet().stream()
                .filter(e -> e.getValue().stream().noneMatch(AnalyticsSignalRow::fullExecution))
                .map(Map.Entry::getKey)
                .sorted()
                .toList();
        insights.add(insight("F", "Which narratives NEVER get FULL_EXECUTION?",
                neverFullExec.isEmpty() ? "All narratives have at least one FULL_EXECUTION" : String.join(", ", neverFullExec),
                neverFullExec.size() > 3 ? "WARN" : "OK",
                Map.of("narrativesNeverFullExec", neverFullExec)));

        Map<String, Long> qualityCounts = rows.stream()
                .collect(Collectors.groupingBy(AnalyticsSignalRow::quality, Collectors.counting()));
        String dominantQuality = qualityCounts.entrySet().stream()
                .max(Comparator.comparingLong(Map.Entry::getValue))
                .map(e -> e.getKey() + " (" + e.getValue() + ")")
                .orElse("—");
        long trapExtended = qualityCounts.getOrDefault("TRAP", 0L) + qualityCounts.getOrDefault("EXTENDED", 0L);
        insights.add(insight("G", "Which quality classifications dominate?",
                dominantQuality + " · TRAP+EXTENDED = " + trapExtended,
                trapExtended > rows.size() / 2 ? "WARN" : "OK",
                Map.of("qualityCounts", qualityCounts)));

        double winnerAvgConv = rows.stream().filter(AnalyticsSignalRow::winner)
                .mapToInt(AnalyticsSignalRow::conviction).average().orElse(0);
        insights.add(insight("H", "Average conviction by winning trade?",
                AnalyticsDistributionEngine.round2(winnerAvgConv) + "% avg conviction on winners",
                winnerAvgConv < 60 ? "WARN" : "OK",
                Map.of("winnerAvgConviction", winnerAvgConv)));

        long contWinners = rows.stream().filter(r -> r.winner() && r.continuationPercent() >= 50).count();
        long fullExecCont = rows.stream().filter(r -> r.fullExecution() && r.continuationPercent() >= 50).count();
        long waitMissed = rows.stream().filter(r -> "WAIT".equals(r.decision()) && r.resultR() >= 1.5).count();
        insights.add(insight("I", "Continuation winners by decision?",
                fullExecCont + " FULL_EXEC captured continuations · " + waitMissed + " WAIT missed >1.5R",
                waitMissed > fullExecCont ? "WARN" : "OK",
                Map.of("continuationWinners", contWinners, "fullExecCapture", fullExecCont, "waitMissed", waitMissed)));

        Map<String, Double> regretByNarrative = rows.stream()
                .filter(r -> r.regretScore() > 0)
                .collect(Collectors.groupingBy(AnalyticsSignalRow::narrative,
                        Collectors.averagingDouble(AnalyticsSignalRow::regretScore)));
        String topRegret = regretByNarrative.entrySet().stream()
                .max(Comparator.comparingDouble(Map.Entry::getValue))
                .map(e -> e.getKey() + " (regret " + AnalyticsDistributionEngine.round2(e.getValue()) + ")")
                .orElse("No regret data");
        insights.add(insight("J", "Suppression regret by narrative?",
                topRegret,
                regretByNarrative.isEmpty() ? "OK" : "INFO",
                Map.of("regretByNarrative", regretByNarrative)));

        return new DiagnosticsSummaryDto(insights, rows.size(), analyticsVersion, System.currentTimeMillis());
    }

    private List<GroupStatDto> groupStats(List<AnalyticsSignalRow> rows, Function<AnalyticsSignalRow, String> keyFn) {
        return rows.stream()
                .collect(Collectors.groupingBy(keyFn))
                .entrySet().stream()
                .map(e -> toGroupStat(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingInt(GroupStatDto::count).reversed())
                .toList();
    }

    private GroupStatDto toGroupStat(String group, List<AnalyticsSignalRow> groupRows) {
        int count = groupRows.size();
        double avgR = groupRows.stream().mapToDouble(AnalyticsSignalRow::resultR).average().orElse(0);
        double winRate = groupRows.stream().filter(AnalyticsSignalRow::winner).count() * 100.0 / count;
        double fakeout = groupRows.stream().filter(AnalyticsSignalRow::fakeout).count() * 100.0 / count;
        double continuation = groupRows.stream().mapToDouble(AnalyticsSignalRow::continuationPercent).average().orElse(0);
        double avgConviction = groupRows.stream().mapToInt(AnalyticsSignalRow::conviction).average().orElse(0);
        double fullExecRate = groupRows.stream().filter(AnalyticsSignalRow::fullExecution).count() * 100.0 / count;
        return new GroupStatDto(
                group,
                count,
                AnalyticsDistributionEngine.round2(avgR),
                AnalyticsDistributionEngine.round2(winRate),
                AnalyticsDistributionEngine.round2(fakeout),
                AnalyticsDistributionEngine.round2(continuation),
                AnalyticsDistributionEngine.round2(avgConviction),
                AnalyticsDistributionEngine.round2(fullExecRate)
        );
    }

    private DiagnosticsInsightDto insight(String id, String question, String answer, String severity, Map<String, Object> metrics) {
        return new DiagnosticsInsightDto(id, question, answer, severity, metrics);
    }

    private String pct(int part, int total) {
        if (total == 0) return "0";
        return String.valueOf(AnalyticsDistributionEngine.round2(part * 100.0 / total));
    }
}
