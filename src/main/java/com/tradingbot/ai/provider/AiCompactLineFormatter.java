package com.tradingbot.ai.provider;

import com.tradingbot.ai.dto.AiDtos.AiExecutionResponseDto;
import com.tradingbot.ai.dto.AiDtos.OpenStructureResponseDto;

import java.util.Locale;

final class AiCompactLineFormatter {
    private AiCompactLineFormatter() {}

    static String execution(AiExecutionResponseDto dto) {
        if (dto.getCompactLine() != null && !dto.getCompactLine().isBlank()) {
            return dto.getCompactLine();
        }
        String quality = dto.getEntryQuality() != null ? dto.getEntryQuality() : "";
        String action = dto.getRecommendedAction() != null ? dto.getRecommendedAction() : "";
        Double fakeout = dto.getFakeoutProbability();

        if (!quality.isBlank() && fakeout != null && fakeout <= 0.25) {
            return "AI · " + quality + " ENTRY · LOW FAKEOUT RISK";
        }
        if ("WAIT".equalsIgnoreCase(action) && dto.getSuggestedEntry() != null && !dto.getSuggestedEntry().isBlank()) {
            return "AI · WAIT FOR " + dto.getSuggestedEntry().toUpperCase(Locale.ROOT);
        }
        if ("WAIT".equalsIgnoreCase(action)) {
            return "AI · WAIT — " + (dto.getSummary() != null ? truncate(dto.getSummary(), 48) : "NO TRIGGER");
        }
        if (fakeout != null && fakeout >= 0.45) {
            return "AI · PREMARKET EXHAUSTION ELEVATED";
        }
        if (!quality.isBlank()) {
            return "AI · " + quality + " ENTRY";
        }
        if (dto.getSummary() != null && !dto.getSummary().isBlank()) {
            return "AI · " + truncate(dto.getSummary(), 56);
        }
        return "";
    }

    static String openStructure(OpenStructureResponseDto dto) {
        if (dto.getClassification() == null || dto.getClassification().isBlank()) return "";
        return "AI · " + dto.getClassification().replace('_', ' ');
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
