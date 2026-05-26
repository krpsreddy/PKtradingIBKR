package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.cognition.CognitionPartDtos.SessionPriorityDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.VisualEmphasisDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class VisualEmphasisService {

    public VisualEmphasisDto emphasize(SessionPriorityDto priority, String selectedSymbol) {
        String target = "execution-panel";
        String cssClass = "emphasis-normal";
        List<String> muted = new ArrayList<>();

        if (priority != null && "high".equals(priority.getSeverity())) {
            cssClass = "emphasis-high";
            if ("SETUP_FOCUS".equals(priority.getCategory())) {
                target = "setup-narrative";
            } else if ("SECTOR".equals(priority.getCategory())) {
                target = "market-internals";
            }
        } else if (priority != null && "medium".equals(priority.getSeverity())) {
            cssClass = "emphasis-medium";
        } else {
            muted.add("ranking-explain");
        }

        if (selectedSymbol != null && !selectedSymbol.isBlank()) {
            target = "setup-narrative";
        }

        return VisualEmphasisDto.builder()
                .highPriorityTarget(target)
                .highPriorityClass(cssClass)
                .mutedTargets(muted)
                .build();
    }
}
