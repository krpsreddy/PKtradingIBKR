package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.BiasAlertDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class AttentionSaturationService {

    public List<String> prioritize(List<String> events, List<BiasAlertDto> biases, List<String> coaching) {
        List<PrioritizedItem> items = new ArrayList<>();
        if (events != null) {
            for (int i = 0; i < events.size(); i++) {
                items.add(new PrioritizedItem(events.get(i), 30 - i));
            }
        }
        if (biases != null) {
            for (BiasAlertDto b : biases) {
                int w = "HIGH".equals(b.getSeverity()) ? 50 : "MEDIUM".equals(b.getSeverity()) ? 35 : 20;
                items.add(new PrioritizedItem("⚠ " + b.getMessage(), w));
            }
        }
        if (coaching != null) {
            for (String c : coaching) {
                items.add(new PrioritizedItem(c, 25));
            }
        }
        if (items.size() <= 3) {
            return items.stream().map(PrioritizedItem::text).toList();
        }
        return items.stream()
                .sorted(Comparator.comparingInt(PrioritizedItem::weight).reversed())
                .limit(3)
                .map(PrioritizedItem::text)
                .toList();
    }

    private record PrioritizedItem(String text, int weight) {}
}
