package com.tradingbot.intelligence.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class SetupDeteriorationDto {
    /** STABLE, WEAKENING, FAILING */
    String state;
    List<String> reasons;
}
