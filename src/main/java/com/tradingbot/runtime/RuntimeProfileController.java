package com.tradingbot.runtime;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/runtime")
@RequiredArgsConstructor
public class RuntimeProfileController {

    private final RuntimeProfileService runtimeProfileService;

    @GetMapping("/profile")
    public RuntimeProfileDto profile() {
        return runtimeProfileService.snapshot();
    }
}
