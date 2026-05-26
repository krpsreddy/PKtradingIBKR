package com.tradingbot.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "telegram")
public class TelegramProperties {
    /** Use telegram.bot-token in properties (not telegram.bot.token — avoids nested binding issues). */
    private String botToken = "";
    /** Use telegram.chat-id in properties (not telegram.chat.id — that binds to a nested chat object). */
    private String chatId = "";
}
