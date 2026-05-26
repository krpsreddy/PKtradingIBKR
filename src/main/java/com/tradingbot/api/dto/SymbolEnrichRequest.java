package com.tradingbot.api.dto;

import lombok.Data;

import java.util.List;

@Data
public class SymbolEnrichRequest {
    private List<String> symbols;
}
