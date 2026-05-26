package com.tradingbot.ai.ml;

import com.tradingbot.ai.dto.AiDtos.AiExecutionRequestDto;

/** Future fakeout classification model. */
public interface FakeoutModel {
    double predict(AiExecutionRequestDto features);
}
