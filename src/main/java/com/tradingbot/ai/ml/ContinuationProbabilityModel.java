package com.tradingbot.ai.ml;

import com.tradingbot.ai.dto.AiDtos.AiExecutionRequestDto;

/** Future XGBoost / LightGBM continuation model. */
public interface ContinuationProbabilityModel {
    double predict(AiExecutionRequestDto features);
}
