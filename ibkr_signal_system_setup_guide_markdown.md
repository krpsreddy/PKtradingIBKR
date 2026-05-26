# IBKR Live Signal Alert System - Setup Guide

# Goal

Build a backend application that:

- Connects to IBKR live market data
- Scans a stock watchlist continuously
- Detects:
  - MOM BUY
  - PULL BUY
  - SOLD BUY
- Sends push notifications to mobile
- Runs 24/7 in background

---

# Recommended Technology Stack

| Component | Technology |
|---|---|
| Backend | Java Spring Boot |
| IDE | IntelliJ IDEA |
| Market Data | IBKR API + IB Gateway |
| Indicators | TA4J |
| Database | PostgreSQL |
| Notifications | Telegram Bot |
| Deployment | Oracle Cloud / AWS / Local PC |

---

# AI Tools Recommendation

| Tool | Purpose |
|---|---|
| ChatGPT | Architecture + coding help |
| GitHub Copilot | Code autocomplete |
| IntelliJ AI Assistant | Optional |
| Cursor AI | Optional advanced coding |

---

# Recommended Subscriptions

## Minimum

You can start with:

- Free ChatGPT
- IntelliJ Community Edition
- IBKR Paper Account

---

## Recommended

| Tool | Recommended? |
|---|---|
| ChatGPT Plus/Go | YES |
| GitHub Copilot | YES |

These significantly improve development speed.

---

# Phase 0 - Environment Setup

# Install Java

Install:

```text
Java 21
```

Verify:

```bash
java -version
```

---

# Install IntelliJ

Download:

```text
IntelliJ IDEA Community Edition
```

---

# Install PostgreSQL

Install PostgreSQL locally.

Create database:

```sql
CREATE DATABASE trading_system;
```

---

# Install IB Gateway

Download:

```text
IBKR Gateway
```

Recommended instead of TWS because:

- lighter
- more stable
- better for automation

---

# Enable API In IB Gateway

Inside IB Gateway:

```text
Settings
→ API
→ Enable ActiveX and Socket Clients
```

Port:

```text
7497 (paper)
7496 (live)
```

---

# Create Spring Boot Project

Use:

```text
Spring Initializr
```

Dependencies:

- Spring Web
- Spring Boot DevTools
- Lombok
- Spring Data JPA
- PostgreSQL Driver

---

# Recommended Project Structure

```text
src/main/java
 ├── config
 ├── ibkr
 ├── indicators
 ├── strategy
 ├── alerts
 ├── scheduler
 ├── models
 ├── services
 └── repository
```

---

# Phase 1 - Connect To IBKR

# Goal

Receive live market prices.

---

# Add IBKR Dependency

## Gradle

```gradle
implementation 'com.ib:ibapi:10.19.1'
```

---

# Milestone 1

Application should:

```text
Connect to IB Gateway
→ Subscribe to NVDA
→ Print live prices
```

---

# Required Components

Create:

```text
IbkrClientService
```

Responsibilities:

- connect
- reconnect
- subscribe market data
- receive ticks

---

# Phase 2 - Candle Builder

# Goal

Convert ticks into candles.

Example:

- 1 minute
- 5 minute
- 4 hour candles

---

# Recommended Timeframe

Use:

```text
4H candles
```

for swing trading.

---

# Candle Object Example

```java
public class Candle {
    private double open;
    private double high;
    private double low;
    private double close;
    private long volume;
}
```

---

# Phase 3 - Indicators

# Add TA4J Dependency

```gradle
implementation 'org.ta4j:ta4j-core:0.16'
```

---

# Indicators Needed

Calculate:

- EMA20
- EMA50
- EMA200
- RSI
- MACD
- ATR
- Volume averages

---

# Milestone 3

Print:

```text
NVDA
RSI = 61
MACD = Bullish
EMA20 = 178
```

---

# Phase 4 - Signal Engine

# MOM BUY Logic

```text
EMA20 > EMA50 > EMA200
AND
MACD crosses above Signal
AND
55 < RSI < 68
AND
Volume > AvgVolume
AND
Close > EMA20
```

---

# PULL BUY Logic

```text
EMA20 > EMA50 > EMA200
AND
MACD > Signal
AND
RSI > 50
AND
Price touched EMA20
AND
Bullish reversal candle
```

---

# SOLD BUY Logic

```text
RSI < 30
AND
RSI rising
AND
MACD improving
AND
Bullish candle
AND
High volume
```

---

# Milestone 4

Application logs:

```text
MOM BUY: NVDA
PULL BUY: AMAT
SOLD BUY: NOW
```

---

# Phase 5 - Telegram Notifications

# Why Telegram?

Advantages:

- free
- instant push notifications
- very easy integration
- works on Android/iPhone

---

# Create Telegram Bot

Use:

```text
@BotFather
```

inside Telegram.

Create:

- bot token
- chat ID

---

# Telegram Dependency

```gradle
implementation 'org.telegram:telegrambots:6.8.0'
```

---

# Example Alert

```text
🚀 MOM BUY
Symbol: NVDA
Price: 178.22
RSI: 61
Timeframe: 4H
```

---

# Milestone 5

Receive live push notifications on phone.

---

# Phase 6 - Watchlist Scanner

# Goal

Scan multiple stocks automatically.

Example:

```text
NVDA
AVGO
AMAT
NOW
META
PLTR
```

---

# Watchlist Config Example

```yaml
symbols:
  - NVDA
  - AVGO
  - AMAT
  - NOW
```

---

# Important

Avoid duplicate alerts.

Store:

- last signal
- last alert timestamp

---

# Phase 7 - Database

# Store

- candles
- signals
- alerts
- historical trades

Recommended:

```text
PostgreSQL
```

---

# Phase 8 - Angular Dashboard

# Dashboard Features

Display:

- watchlist
- active signals
- RSI
- MACD
- EMA trend
- charts
- alert history

---

# Phase 9 - Cloud Deployment

# Recommended VPS

## Oracle Cloud Free Tier

Very good for personal projects.

Alternative:

- AWS EC2
- DigitalOcean
- Hetzner

---

# Recommended Runtime Setup

Run:

```text
Spring Boot App
+
IB Gateway
```

24/7.

---

# Best Development Workflow

# DO NOT Build Everything Together

Build incrementally.

---

# Correct Order

```text
1. Connect IBKR
2. Receive prices
3. Build candles
4. Calculate indicators
5. Generate signals
6. Send Telegram alerts
7. Add database
8. Add dashboard
9. Deploy to cloud
```

---

# Important Engineering Advice

Keep separate modules for:

- market data
- indicators
- strategy engine
- alerts
- persistence

Do NOT tightly couple components.

---

# Recommended First Milestone

ONLY build:

```text
Spring Boot
→ connect IBKR
→ subscribe NVDA
→ send Telegram notification
```

Do not overbuild initially.

---

# Final Recommended Stack

```text
Java Spring Boot
+
IB Gateway
+
TA4J
+
Telegram Bot
+
PostgreSQL
```

This is scalable, realistic, and matches your existing Java + Angular experience.

