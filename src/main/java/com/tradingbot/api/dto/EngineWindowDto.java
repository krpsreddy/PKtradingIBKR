package com.tradingbot.api.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class EngineWindowDto {
    String code;
    String label;
    String windowEt;
    String triggerMode;
    boolean activeNow;
}
