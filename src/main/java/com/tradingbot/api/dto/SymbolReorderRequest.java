package com.tradingbot.api.dto;

import lombok.Data;

import java.util.List;

@Data
public class SymbolReorderRequest {
    private List<String> symbols;
}
