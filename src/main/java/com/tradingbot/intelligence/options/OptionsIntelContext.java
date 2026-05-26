package com.tradingbot.intelligence.options;

import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.AdaptiveExitDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.ExpectedMoveDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.FailureSignatureDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.ProbabilityDecayDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.SetupHalfLifeDto;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class OptionsIntelContext {
    String signalType;
    String regime;
    String entryQuality;
    int setupAgeMinutes;
    double rvol;
    boolean extended;
    boolean choppy;
    boolean regimeAligned;
    boolean deteriorating;
    ExpectedMoveDto expectedMove;
    SetupHalfLifeDto halfLife;
    ProbabilityDecayDto decay;
    FailureSignatureDto failure;
    AdaptiveExitDto exit;
    int etHour;
    int etMinute;
    MarketTrendDto trend;
}
