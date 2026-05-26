package com.tradingbot.intelligence.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class ExtendedStateDto {
    boolean extended;
    String state;
    List<String> reasons;
    String optionsWarning;
}
