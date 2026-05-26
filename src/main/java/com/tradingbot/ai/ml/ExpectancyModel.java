package com.tradingbot.ai.ml;

import com.tradingbot.ai.dto.AiDtos.AiExecutionRequestDto;

/** Future expectancy regression model. */
public interface ExpectancyModel {
    double predictR(AiExecutionRequestDto features);
}
