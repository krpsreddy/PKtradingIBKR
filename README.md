# PKtradingIBKR

Trading signal platform: **Spring Boot** backend (IBKR, PostgreSQL, Telegram) and **Angular** execution dashboard (autonomous scanner, dominant opportunity engine, replay intelligence).

> **Architecture & phases:** [PROJECT_INTELLIGENCE_README.md](PROJECT_INTELLIGENCE_README.md) · [docs/](docs/README.md)  
> **Trader terminology (canonical):** [docs/architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md](docs/architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md)

**Remote:** [github.com/krpsreddy/PKtradingIBKR](https://github.com/krpsreddy/PKtradingIBKR)

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | Java 21, Spring Boot 3.3, Maven, PostgreSQL, TA4J, IBKR API |
| Frontend | Angular 19, standalone components, dark execution UI |
| Alerts | Telegram Bot API |

---

## Backend (quick start)

Spring Boot connects to **IBKR Gateway**, builds candles, indicators, signals, Telegram alerts, PostgreSQL persistence.

### Prerequisites

1. Java 21, Maven, PostgreSQL (`trading_signals`)
2. IB Gateway / TWS (API enabled; paper port **7497** typical)
3. Telegram bot token + chat ID
4. IB API JAR (not on Maven Central) — see [TWS API](https://interactivebrokers.github.io)

```bash
mvn install:install-file \
  -Dfile=/path/to/TwsApi.jar \
  -DgroupId=com.ib \
  -DartifactId=client \
  -Dversion=10.37.02 \
  -Dpackaging=jar
```

Copy `src/main/resources/application.properties.example` → `application-local.properties` for secrets (gitignored).

```bash
export TELEGRAM_BOT_TOKEN=your_token
export TELEGRAM_CHAT_ID=your_chat_id
mvn spring-boot:run
```

### Legacy MOM BUY rules

- EMA20 > EMA50, MACD > signal, RSI 55–68, close > EMA20

---

## Frontend (quick start)

```bash
cd frontend
npm install
npm start
```

Build: `npm run build`

---

## Autonomous execution terminology

The **canonical** trader label reference lives in:

**[docs/architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md](docs/architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md)**

It covers regime IDs, execution/dominance/exit/lifecycle labels, source-of-truth files, governance rules, hybrid vs autonomous migration status, and the trader cheat sheet.

Cursor sessions: read [PROJECT_INTELLIGENCE_README.md](PROJECT_INTELLIGENCE_README.md) then the terminology doc before changing scanner, execution, replay, sidebar, or execution-plan UI.

---

## Project layout

```
pktradingIBKR/
  src/main/java/com/tradingbot/   # Spring Boot backend
  frontend/src/app/               # Angular dashboard
  docs/                           # Intelligence & phase docs
  dev/ngrok/                      # Local tunnel helpers (secrets gitignored)
```

---

## License

Private / personal trading research project. Do not commit `application-local.properties`, Telegram tokens, or `dev/ngrok/.env`.
