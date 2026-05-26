package com.tradingbot.intelligence.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class NoEdgeDto {
    boolean noEdge;
    String message;
    List<String> reasons;
}
