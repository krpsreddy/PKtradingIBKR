# IBKR Live Signal Alert System — Complete Implementation Roadmap

**TL;DR:** Build a 10-phase Java Spring Boot trading system connecting IBKR for live market data, calculating technical indicators, generating trading signals, and sending Telegram alerts. Start with MVP milestone: Spring Boot + IBKR connection + NVDA subscription + Telegram notification. Progress through candle building, indicator calculation, signal engine, watchlist scanning, database persistence, and Angular dashboard, before final cloud deployment.

---

## Phase 0: Environment Setup & Project Foundation

### Steps

1. **Verify Java and configure Maven** — Confirm Java 21+ installed; upgrade `pom.xml` to Java 21 compiler; add Spring Boot parent and essential properties.

2. **Add core Spring Boot dependencies** — Add `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-devtools`, `lombok`; configure Telegram, IBKR API, TA4J, PostgreSQL driver.

3. **Create project directory structure** — Establish package hierarchy: `config`, `ibkr`, `indicators`, `signals`, `alerts`, `scheduler`, `models`, `services`, `repository`, `utils`.

4. **Set up application properties** — Create `application.properties` with Spring boot server port (8080), logging level, PostgreSQL placeholders.

5. **Initialize Spring Boot main class** — Refactor `Main.java` to `Application.java` with `@SpringBootApplication` annotation and `main()` entry point.

6. **Create `.gitignore` and README** — Ensure IDE files, build artifacts, and sensitive configs excluded; document project purpose and setup instructions.

### Further Considerations

1. **Java version lock** — Use Java 21 for LTS stability and features; verify IntelliJ recognizes it.

2. **Gradle vs Maven** — Project uses Maven. Maven is fine; stick with Maven as set up.

3. **Spring Boot version** — Recommend: Spring Boot 3.3.x (latest stable LTS, Java 21+ compatible).

---

## Phase 1: Connect to IBKR & Subscribe to Market Data

### Components Overview

```
IBKRClientService (primary connector)
├── IBMessage Handler (callback processor)
├── TickProcessor (raw tick handler)
└── ConnectionManager (reconnect logic)
```

### Steps

1. **Add IBKR Gateway dependency** — Add `com.ib:ibapi:10.19.1+` to `pom.xml`; verify JAR availability (IBKR API requires custom repository configuration or local JAR).

2. **Create `IBKRClientService`** — Implement in `src/main/java/org/example/ibkr/IBKRClientService.java`:
   - Extend/wrap `EClientSocket`
   - Implement `connect(host, port, clientId)` method
   - Implement `subscribeMarketData(contractId, symbol)` method
   - Handle reconnection logic with exponential backoff

3. **Create `IBMessage` handler** — Implement wrapper class `IBKRMessageHandler.java`:
   - Override `tickPrice()`, `tickSize()`, `tickString()` callbacks
   - Parse incoming tick data (bid, ask, last price, volume)
   - Emit events to event bus for downstream processing

4. **Create `Tick` model class** — Add `Tick.java`:
   - Fields: `symbol`, `price`, `size`, `timestamp`, `tickType` (BID, ASK, LAST)
   - Getters/setters with Lombok `@Data`

5. **Create Spring Boot `IBKRConfiguration`** — Add `IBKRConfig.java`:
   - Bean auto-initialization of `IBKRClientService`
   - Configuration properties: `ibkr.gateway.host`, `ibkr.gateway.port`, `ibkr.client.id`
   - Connection lifecycle management

6. **Create `TickListener` interface** — Define contract for tick event subscribers in `TickListener.java`.

### Milestone 1 Checkpoint

**Application successfully:**
- Connects to IB Gateway on port 7497 (paper) or 7496 (live)
- Subscribes to NVDA market data
- Receives and logs live ticks: `NVDA tick: bid=178.50, ask=178.52, time=14:32:45`
- Handles reconnection on network failure

### Further Considerations

1. **IB Gateway API availability** — IBKR API JAR not in Maven Central. **Choose:** Download from [IBKR website](https://www.interactivebrokers.com/en/trading/ib-api.php) and install locally via `mvn install:install-file`, OR use custom Nexus repo. **Recommend: Local install for immediate start.**

2. **Contract specification** — NVDA subscription requires Contract object. **Use:** `symbol=NVDA, secType=STK, exchange=SMART, currency=USD`.

3. **Graceful shutdown** — Handle connection cleanup. **Add:** Spring `DisposableBean` to close IBKR socket on app shutdown.

---

## Phase 2: Candle Builder — Aggregate Ticks into OHLCV Candles

### Components Overview

```
CandleBuilder (orchestrator)
├── CandleAggregator (time-window manager)
│   ├── 1-minute window
│   ├── 5-minute window
│   └── 4-hour window
├── Candle (data model)
└── CandleRepository (persistence interface)
```

### Steps

1. **Create `Candle` model class** — Add `Candle.java`:
   - Fields: `symbol`, `open`, `high`, `low`, `close`, `volume`, `openTime`, `closeTime`, `timeframe` (1MIN, 5MIN, 4HOUR)
   - Lombok `@Data`, `@Builder` annotations
   - JPA `@Entity` annotations

2. **Create `CandleAggregator`** — Implement `CandleAggregator.java`:
   - Maintain three active candles per symbol (1m, 5m, 4h)
   - Implement `processTick(Tick)` to update OHLCV
   - Emit completed candles when time window closes
   - Use `LocalDateTime` for window boundaries with time-window precision

3. **Create `CandleEvent` class** — Add `CandleCompletedEvent.java`:
   - Spring Application Event for candle completion notifications
   - Allows loose coupling between builders and consumers

4. **Create `CandleListener` service** — Implement `CandleListener.java`:
   - Subscribe to tick events from Phase 1
   - Invoke `CandleAggregator.processTick()`
   - Publish `CandleCompletedEvent` via Spring's `ApplicationEventPublisher`

5. **Add `CandleRepository` interface** — Create `CandleRepository.java`:
   - Extend `JpaRepository<Candle, Long>`
   - Query methods: `findBySymbolAndTimeframe()`, `findLatest()`
   - Placeholder for Phase 7 database integration

6. **Update application configuration** — Modify `application.properties`:
   - Add `candle.timeframes=1MIN,5MIN,4HOUR`

### Milestone 2 Checkpoint

**Application logs:**
```
Tick: NVDA price=178.45 
Tick: NVDA price=178.46
Candle completed: NVDA 1MIN 14:32 OHLC=178.40/178.50/178.35/178.45 vol=50000
```

### Further Considerations

1. **Candle closure timing** — Use `ZonedDateTime` for timezone consistency. **Recommend: UTC for market data; convert on display.**

2. **Overlapping candles** — 5-min and 4-hour candles overlap; handle without duplication. **Use: Separate aggregators with independent timers.**

3. **Memory efficiency** — Store only recent 200 candles in memory. **Implement: Rolling buffer or evict old via repository query.**

---

## Phase 3: Technical Indicators Calculation

### Components Overview

```
IndicatorCalculator (orchestrator)
├── EMACalculator (EMA20, EMA50, EMA200)
├── RSICalculator
├── MACDCalculator
├── ATRCalculator
└── VolumeAnalyzer (average volume)
```

### Steps

1. **Add TA4J dependency** — Add to `pom.xml`: `org.ta4j:ta4j-core:0.16`.

2. **Create `Indicator` model** — Add `Indicator.java`:
   - Fields: `symbol`, `ema20`, `ema50`, `ema200`, `rsi`, `macdLine`, `signalLine`, `macdHistogram`, `atr`, `avgVolume`, `timestamp`
   - Lombok `@Data`, `@Builder`
   - JPA `@Entity` annotations

3. **Create `IndicatorCalculator`** — Implement `IndicatorCalculator.java`:
   - Accept list of candles (sorted by time)
   - Calculate 6 indicators using TA4J library
   - Return `Indicator` object with all values
   - Public methods: `calculateEMA(candles, period)`, `calculateRSI()`, `calculateMACD()`, `calculateATR()`, `calculateAll()`

4. **Create `IndicatorListener`** — Implement `IndicatorListener.java`:
   - Listen for `CandleCompletedEvent` (Phase 2)
   - Fetch recent 200 candles for symbol
   - Invoke `IndicatorCalculator.calculateAll()`
   - Publish `IndicatorCalculatedEvent`

5. **Create `IndicatorRepository`** — Add `IndicatorRepository.java`:
   - Extend `JpaRepository<Indicator, Long>`
   - Query: `findLatestBySymbol(symbol)`

6. **Create specific Calculator classes**:
   - `EMACalculator.java` — Exponential Moving Average
   - `RSICalculator.java` — Relative Strength Index
   - `MACDCalculator.java` — MACD and Signal Line
   - `ATRCalculator.java` — Average True Range

### Milestone 3 Checkpoint

**Application logs:**
```
Indicators for NVDA (4H candle):
  EMA20 = 178.12
  EMA50 = 176.85
  EMA200 = 172.40
  RSI = 61
  MACD = 0.85 (signal line: 0.72)
  ATR = 2.15
  Avg Volume = 45M
```

### Further Considerations

1. **Minimum candles required** — EMA200 requires 200 candles minimum. **Implement: Cache logic to skip indicator calculation until sufficient history; log warnings.**

2. **Update frequency** — Recalculate all indicators per completed candle. **Optimize: Only recalculate changed values (last EMA vs all history).**

3. **Precision and rounding** — Use `BigDecimal` or double precision. **Recommend: `double` for speed; round to 2 decimals for display.**

---

## Phase 4: Trading Signal Engine

### Components Overview

```
SignalEngine (orchestrator)
├── MOMBuySignal (logic evaluator)
├── PULLBuySignal (logic evaluator)
├── SOLDBuySignal (logic evaluator)
└── SignalValidator (confirmation checks)
```

### Steps

1. **Create `Signal` model** — Add `Signal.java`:
   - Enum `SignalType: MOM_BUY, PULL_BUY, SOLD_BUY, NONE`
   - Fields: `symbol`, `signalType`, `price`, `indicator` (snapshot), `timestamp`, `confidence` (0-100)
   - Lombok `@Data`, `@Builder`
   - JPA `@Entity` annotations

2. **Create `SignalValidator`** — Implement `SignalValidator.java`:
   - Validate MOM BUY: `EMA20 > EMA50 > EMA200 && MACD crosses signal && 55 < RSI < 68 && volume > avg_volume && close > EMA20`
   - Validate PULL BUY: `EMA20 > EMA50 > EMA200 && MACD > signal && RSI > 50 && price touched EMA20 && bullish candle`
   - Validate SOLD BUY: `RSI < 30 && RSI_rising && MACD_improving && bullish_candle && high_volume`
   - Methods: `validateMomBuy(Candle, Indicator)`, `validatePullBuy()`, `validateSoldBuy()`, `evaluateAll()` → `Signal`

3. **Create `HistoricalContext`** — Implement `HistoricalContext.java`:
   - Track previous candles (n-1, n-2, n-3) for trend analysis
   - Detect MACD cross: compare `macdLine[n-1] < signalLine[n-1] && macdLine[n] > signalLine[n]`
   - Detect RSI rising: `RSI[n] > RSI[n-1]`
   - Methods: `setCandleHistory()`, `isMACDCrossing()`, `isRSIRising()`, `getBullishCandle()`

4. **Create `SignalEngine`** — Implement `SignalEngine.java`:
   - Listen for `IndicatorCalculatedEvent`
   - Invoke `SignalValidator.evaluateAll()`
   - Emit `SignalDetectedEvent` if signal confidence > threshold (e.g., 70%)
   - Methods: `processIndicators(Indicator, HistoricalContext)`, `generateSignal()`

5. **Create `SignalRepository`** — Add `SignalRepository.java`:
   - `findLatestBySymbol()`, `findAllBySymbolAndType()`, `findByTimestampRange()`

6. **Add duplicate prevention logic** — Implement `DuplicateSignalFilter` in `SignalEngine.java`:
   - Track `lastSignal[symbol]` and `lastSignalTime[symbol]`
   - Skip if same signal within 4 hours

### Milestone 4 Checkpoint

**Application logs:**
```
Signal detected: MOM_BUY
  Symbol: NVDA
  Price: 178.22
  RSI: 61 (range: 55-68 ✓)
  EMA Trend: 178.12 > 176.85 > 172.40 ✓
  MACD Cross: YES ✓
  Confidence: 95%
```

### Further Considerations

1. **Signal confirmation** — Add multi-timeframe confirmation. **Option A:** Require 5-min AND 4-hour signal alignment / **Option B:** Use 4-hour as primary, 1-min for timing / **Recommend: Option B for responsiveness.**

2. **False positive rates** — Back-test against historical data. **Add:** Configurable confidence threshold in `application.properties`.

3. **Edge cases** — Handle gap opens, halts, low volume. **Add:** Min vol threshold = 1M shares, skip signals during market open (first 30 min).**

---

## Phase 5: Telegram Bot Integration & Alerts

### Components Overview

```
TelegramAlertService (orchestrator)
├── BotConfiguration (auth & setup)
├── AlertFormatter (rich message creation)
└── MessageSender (delivery)
```

### Steps

1. **Add Telegram Bot dependency** — Add to `pom.xml`: `org.telegram:telegrambots:6.8.0`.

2. **Create Telegram configuration** — Add `TelegramConfig.java`:
   - Read bot token from environment: `TELEGRAM_BOT_TOKEN`
   - Read chat ID from environment: `TELEGRAM_CHAT_ID`
   - Implement Spring `@Configuration` class with `@Bean` for bot setup

3. **Create `TelegramAlertService`** — Implement `TelegramAlertService.java`:
   - Extend `TelegramLongPollingBot`
   - Implement `onUpdateReceived()` (handler for incoming messages, optional)
   - Create public method `sendAlert(Signal)` to format and send messages
   - Methods: `formatMomBuyAlert()`, `formatPullBuyAlert()`, `formatSoldBuyAlert()`, `buildAlertMessage()`

4. **Create `AlertFormatter`** — Implement `AlertFormatter.java`:
   - Create rich message formats with emojis for each signal type
   - Example MOM BUY: `🚀 MOM BUY\nSymbol: NVDA\nPrice: $178.22\nRSI: 61\nTimeframe: 4H\nTime: 2024-01-15 14:32 UTC`
   - Methods: `getMomBuyMessage()`, `getPullBuyMessage()`, `getSoldBuyMessage()`

5. **Create `AlertListener`** — Implement `AlertListener.java`:
   - Listen for `SignalDetectedEvent` (Phase 4)
   - Invoke `TelegramAlertService.sendAlert()`
   - Log alert sent event

6. **Create `AlertRepository`** — Add `AlertRepository.java`:
   - Track sent alerts (prevent duplicates during restarts)
   - Fields: `signal_id`, `sent_time`, `status` (SUCCESS, FAILED, PENDING)

7. **Add error handling & retry logic** — Implement in `TelegramAlertService.java`:
   - Catch `TelegramApiException`
   - Implement exponential backoff retry (max 3 attempts)
   - Log failures to database

### Milestone 5 Checkpoint

**Receive live Telegram notification on phone:**
```
🚀 MOM BUY
Symbol: NVDA
Price: $178.22
RSI: 61 (⚡ Bullish)
MACD: Crossing Up
EMA Trend: Bullish (20 > 50 > 200)
Timeframe: 4H
⏰ 2024-01-15 14:32 UTC

🔗 Chart: [TradingView Link]
```

### Further Considerations

1. **Telegram bot setup** — Requires manual creation via @BotFather. **Document:** Step-by-step in README with screenshots.

2. **Message rate limiting** — Telegram allows 30 msgs/sec. **With 50 stocks, max 1 signal/stock/hour = safe.** Add throttling if needed.

3. **Rich formatting** — Support HTML or Markdown for links/formatting. **Recommend: HTML for clickable links to TradingView.**

---

## Phase 6: Watchlist Scanner — Multi-Symbol Continuous Monitoring

### Components Overview

```
WatchlistService (orchestrator)
├── WatchlistLoader (config/database)
├── ScannerScheduler (background task)
├── SymbolProcessor (per-symbol pipeline)
└── WatchlistRepository (persistence)
```

### Steps

1. **Create `Watchlist` & `WatchlistItem` models** — Add `Watchlist.java` and `WatchlistItem.java`:
   - `Watchlist` fields: `name`, `createdAt`, `isActive`
   - `WatchlistItem` fields: `symbol`, `sector`, `addedAt`
   - Use Lombok `@Data`, `@ToString`
   - JPA `@Entity` annotations

2. **Create `WatchlistConfig.yaml`** — Add `watchlist.yaml`:
   ```yaml
   watchlist:
     name: My Trading Watch
     symbols:
       - NVDA
       - AVGO
       - AMAT
       - NOW
       - META
       - PLTR
   ```

3. **Create `WatchlistService`** — Implement `WatchlistService.java`:
   - Load symbols from YAML config on startup
   - Implement `getActiveWatchlist()`, `addSymbol()`, `removeSymbol()`
   - Methods: `loadWatchlistFromConfig()`, `reloadDynamically()`

4. **Create `SymbolProcessor`** — Implement `SymbolProcessor.java`:
   - Single-responsibility: process one symbol end-to-end
   - Chain: IBKR ticks → Candles → Indicators → Signals → Alerts
   - Methods: `processSymbol(symbol)`, `ensureSubscribed()`, `runFullAnalysis()`

5. **Create `ScannerScheduler`** — Implement `ScannerScheduler.java`:
   - Use Spring `@Scheduled(fixedDelay=)` or `@Async`
   - Initialize IBKR subscriptions for all symbols at startup
   - Process incoming ticks in background thread
   - Methods: `initializeWatchlist()`, `processMarketData()`, `handleSymbolError()`

6. **Create `AlertDeduplicator`** — Implement `AlertDeduplicator.java`:
   - Track last alert per symbol: `lastAlertBySymbol[symbol] = (signal_type, timestamp)`
   - Skip duplicate signals within 4-hour window
   - Methods: `shouldAlert(Signal)`, `recordAlert()`

7. **Create `WatchlistRepository`** — Add `WatchlistRepository.java`:
   - Extend `JpaRepository<Watchlist, Long>`
   - Query: `findAllActive()`

### Milestone 6 Checkpoint

**Application logs (continuous scan every 1 min):**
```
[14:30] Processing watchlist: 6 symbols
[14:30] NVDA: ticks received=45, no signal
[14:30] AVGO: ticks received=38, MOM_BUY detected ✓ → Alert sent
[14:30] AMAT: ticks received=52, PULL_BUY detected ✓ → Alert sent
[14:30] NOW: ticks received=31, no signal
[14:30] META: ticks received=41, SOLD_BUY detected ✓ → Alert sent
[14:30] PLTR: ticks received=28, no signal
[14:31] Scan complete. Next scan in 1 minute.
```

### Further Considerations

1. **IBKR subscription limits** — Each subscription consumes API bandwidth. **Limit: 50 active subscriptions recommended.** Add health check if > 50.

2. **Dynamic watchlist reloading** — Support adding/removing symbols without restart. **Add:** Admin endpoint `/api/watchlist/add` (Phase 8 auth optional for MVP).

3. **Time zone handling** — Market data uses exchange time. **Use:** `ZonedDateTime` with `America/New_York` for US equities.

---

## Phase 7: PostgreSQL Database Integration

### Components Overview

```
DatabaseConfiguration
├── Entity Models (Candle, Indicator, Signal, Alert, Watchlist)
├── JPA Repositories (READ/WRITE)
└── DatabaseInitializer (DDL + seed data)
```

### Steps

1. **Add PostgreSQL dependencies** — Already in Phase 0; confirm `pom.xml` contains:
   - `org.springframework.boot:spring-boot-starter-data-jpa`
   - `org.postgresql:postgresql` (runtime scope)

2. **Create database schema** — Add `schema.sql`:
   - SQL DDL for all tables
   - Create indexes for performance
   - See schema.sql in project resources

3. **Update entity models with JPA annotations** — Modify existing models:
   - Add `@Entity`, `@Table` to `Candle.java`
   - Add `@Id`, `@GeneratedValue` (IDENTITY strategy)
   - Add `@ManyToOne` relationships where applicable

4. **Configure PostgreSQL connection** — Update `application.properties`:
   ```properties
   spring.datasource.url=jdbc:postgresql://localhost:5432/trading_system
   spring.datasource.username=postgres
   spring.datasource.password=${DB_PASSWORD:password}
   spring.jpa.hibernate.ddl-auto=validate
   spring.jpa.show-sql=false
   ```

5. **Create repository implementations** — Update all repositories:
   - `CandleRepository.java` with query methods
   - `IndicatorRepository.java`
   - `SignalRepository.java`
   - `AlertRepository.java`
   - `WatchlistRepository.java`

6. **Implement persistence layer** — Create services for saving:
   - `CandleService.save(Candle)` called after candle completion
   - `IndicatorService.save(Indicator)` after calculation
   - `SignalService.save(Signal)` after detection
   - `AlertService.save(Alert)` after transmission

7. **Add database initialization** — Create `DatabaseInitializer.java`:
   - Spring `@Component` with `@EventListener(ContextRefreshedEvent.class)`
   - Create default watchlist if not exists
   - Log schema validation results

### Milestone 7 Checkpoint

**Application logs (confirm database integration):**
```
[INFO] Initializing database connection...
[INFO] Connected to PostgreSQL: trading_system (version 14.5)
[INFO] Schema validation: PASSED
[INFO] Default watchlist loaded: 6 symbols
[INFO] Previous candles loaded: 540
[INFO] Previous signals loaded: 127
```

**PostgreSQL confirm:**
```sql
SELECT COUNT(*) FROM candles;  -- Should grow on each new candle
SELECT * FROM signals ORDER BY detected_at DESC LIMIT 5;  -- Recent signals
```

### Further Considerations

1. **Migration tool** — Use Flyway or Liquibase for schema versioning. **For MVP: Use Spring's `ddl-auto=validate` with manual schema.sql.**

2. **Connection pooling** — HikariCP auto-configured by Spring. **Default OK; tune if errors: `spring.datasource.hikari.maximum-pool-size=20`.**

3. **Query performance** — Add indexes on foreign keys and frequently queried columns (already in schema.sql).

---

## Phase 8: Angular Dashboard UI

### Components Overview

```
Frontend (Angular 18+)
├── Dashboard Component (overview)
├── Chart Component (TradingView Lightweight Charts)
├── Watchlist Component (real-time table)
├── Alerts Component (notification history)
└── API Client (HTTP interceptors)
```

### Steps

1. **Initialize Angular project** — In workspace sibling folder:
   ```bash
   ng new ibkr-trading-dashboard --routing --style=css
   ```
   Create at same level as backend: `/Users/pk/IdeaProjects/ibkr-trading-dashboard`

2. **Create REST API endpoints** — Add controller in backend `DashboardController.java`:
   - `GET /api/dashboard/overview` → returns latest signals + indicators for all symbols
   - `GET /api/watchlist` → returns active watchlist
   - `GET /api/candles/{symbol}?timeframe=4H&limit=100` → returns last 100 candles for chart
   - `GET /api/alerts?limit=50` → returns recent alerts
   - `GET /api/signals?symbol=NVDA` → returns signals for symbol
   - `POST /api/watchlist/add` → add symbol (optional auth)
   - `DELETE /api/watchlist/{symbol}` → remove symbol

3. **Create API service** — Add `DashboardService.ts`:
   - `getOverview()`, `getWatchlist()`, `getCandles()`, `getAlerts()`, `getSignals()`
   - Configure `HttpClient` with base URL

4. **Create dashboard components** — Generate Angular components:
   - `DashboardComponent` (main layout)
   - `WatchlistTableComponent` (real-time pricing)
   - `ChartComponent` (TradingView Lightweight Charts for NVDA)
   - `AlertHistoryComponent` (paginated table)
   - `IndicatorWidgetComponent` (RSI, MACD, EMA display)

5. **Add TradingView Lightweight Charts** — Install dependency:
   ```bash
   npm install lightweight-charts
   ```
   - Implement chart rendering in `ChartComponent`
   - Display 4H candles with EMA overlays

6. **Implement WebSocket live updates** — Create `WebSocketService.ts`:
   - Connect to Spring Messaging (SimpMessagingTemplate)
   - Subscribe to `/topic/candles/{symbol}`, `/topic/alerts`
   - Auto-refresh dashboard on new signals

7. **Add UI styling** — Use Angular Material or Bootstrap:
   - Responsive layout for desktop + mobile
   - Color coding: Green for BUY signals, Red for warnings
   - Dark mode toggle

8. **Deploy frontend** — Build and serve:
   ```bash
   ng build --prod
   ```
   - Spring Boot serves static files from `src/main/resources/static`
   - OR deploy separately to Vercel/Netlify

### Milestone 8 Checkpoint

**Access dashboard at `http://localhost:8080`:**
- Watchlist shows 6 symbols with live bid/ask
- 4H chart shows last 100 NVDA candles + EMA20/50/200 overlays
- Alert history shows recent MOM_BUY / PULL_BUY / SOLD_BUY alerts
- Real-time WebSocket updates deliver new candles/alerts live
- Click symbol to filter chart

### Further Considerations

1. **Authentication & authorization** — MVP skips auth. **For production: Add Spring Security + JWT tokens.**

2. **Performance optimization** — Large datasets slow pagination. **Implement: Server-side pagination, lazy loading, data virtualization.**

3. **Mobile responsiveness** — Tested on desktop only. **Add: CSS media queries or responsive Angular Material grid.**

---

## Phase 9: Cloud Deployment & 24/7 Operations

### Components Overview

```
Production Environment
├── Cloud Instance (Oracle Cloud / AWS)
├── IB Gateway (running 24/7)
├── Spring Boot Application (containerized)
├── PostgreSQL Database (managed service)
├── Monitoring & Logging (CloudWatch / Stackdriver)
└── CI/CD Pipeline (GitHub Actions)
```

### Steps

1. **Containerize application** — Create `Dockerfile`:
   ```dockerfile
   FROM openjdk:21-slim
   COPY target/pktradingIBKR-1.0-SNAPSHOT.jar app.jar
   ENTRYPOINT ["java","-jar","/app.jar"]
   EXPOSE 8080
   ```
   - Build: `mvn clean package -DskipTests`
   - Docker build: `docker build -t ibkr-trading:latest .`

2. **Set up cloud infrastructure** — Oracle Cloud Free Tier / AWS:
   - Provision VM (2 CPU, 1GB RAM minimum)
   - Install Docker and docker-compose
   - Set up PostgreSQL (managed RDS or self-hosted)
   - Open security group: ports 8080 (Spring Boot), 7497 (IB Gateway)

3. **Create deployment script** — Add `deploy.sh`:
   ```bash
   #!/bin/bash
   docker pull ibkr-trading:latest
   docker-compose down || true
   docker-compose up -d
   ```

4. **Set up monitoring & alerting** — Configure:
   - Spring Boot Actuator endpoints: `/actuator/health`, `/actuator/metrics`
   - Log aggregation: Elasticsearch / CloudWatch
   - Alert on service failure, DB disconnection, IBKR connection loss
   - Email/SMS alerts for critical failures

5. **Configure IB Gateway for headless operation** — Set up on VM:
   - Download IB Gateway
   - Enable API (port 7496 for live, 7497 for paper)
   - Run in background: `java -jar ibgateway.jar`
   - Implement auto-restart on failure (systemd service or cron)

6. **Set up database backups** — PostgreSQL:
   - Daily automated backups to S3 / Oracle Object Storage
   - Retention: 30 days
   - Test restore procedure monthly

7. **Implement health checks** — Add Spring Boot health endpoint `HealthController.java`:
   - Check IBKR connection status
   - Check database connectivity
   - Return `UP` / `DOWN` with details
   - Cloud system monitors every 5 minutes

8. **Implement graceful shutdown** — Add Spring `@Bean` for `GracefulShutdownHook`:
   - Close IBKR connection on shutdown
   - Wait for pending alerts to send (max 10 sec)
   - Close DB connection pool

### Milestone 9 Checkpoint

**Production system:**
- Application running 24/7 on cloud VM
- Scans watchlist every 1 minute
- Sends alerts to Telegram in real-time
- Historical candles + signals stored in PostgreSQL
- Dashboard accessible via `https://trading.example.com`
- Monitoring dashboard shows system health

### Further Considerations

1. **Cost optimization** — Oracle Cloud Free Tier sufficient for small watchlist. **Monitor: CPU, bandwidth, storage costs.**

2. **Redundancy** — Single cloud instance is single point of failure. **For future: Add standby instance with auto-failover.**

3. **Compliance & logging** — Audit trail of all signals/alerts. **Use: Structured JSON logging; retention 1 year.**

---

## **MILESTONE 1 FOCUS: Spring Boot → IBKR → NVDA → Telegram**

After Phase 0 setup and Phase 1-5 core implementation, you'll achieve this MVP:

```
┌───────────────────────────────────────────────────┐
│         Spring Boot Application                    │
│  Port: 8080                                       │
├───────────────────────────────────────────────────┤
│  ┌─────────────────┐                             │
│  │ IBKR Connection │ (IB Gateway on 7497)        │
│  │  IBKRClientSvc  │                             │
│  └────────┬────────┘                             │
│           │ Live NVDA ticks                       │
│  ┌────────▼────────┐                             │
│  │ Candle Builder  │ 4H candles                  │
│  │ CandleAggregator│                             │
│  └────────┬────────┘                             │
│           │ OHLCV data                            │
│  ┌────────▼──────────┐                           │
│  │ Indicator Engine  │ EMA, RSI, MACD              │
│  │ IndicatorCalc     │                           │
│  └────────┬──────────┘                           │
│           │ Indicator values                      │
│  ┌────────▼──────────┐                           │
│  │ Signal Generator  │ MOM_BUY detection         │
│  │ SignalEngine      │                           │
│  └────────┬──────────┘                           │
│           │ Signal: MOM_BUY@178.22               │
│  ┌────────▼──────────┐                           │
│  │ Telegram Alert    │ Send notification         │
│  │ TelegramAlertSvc  │                           │
│  └───────────────────┘                           │
│                                                  │
│  Push notification → 📱 Your phone                │
└───────────────────────────────────────────────────┘
```

**To complete Milestone 1, implement:**
- Phase 0: Maven + Spring Boot foundation ✓
- Phase 1: IBKR connection to IB Gateway + NVDA subscription
- Phase 2: Candle building (1 min test, 4H production)
- Phase 3: Indicators (EMA20/50/200, RSI minimum)
- Phase 4: Signal engine (MOM_BUY logic only)
- Phase 5: Telegram notifications (formatted alert)

**Estimated time to Milestone 1:** 2-3 weeks of incremental development.

---

## Cross-Cutting Concerns (All Phases)

### Dependency Management Summary

```xml
<!-- Core Spring Boot -->
<spring-boot-starter-web>3.3.x</spring-boot-starter-web>
<spring-boot-starter-data-jpa>3.3.x</spring-boot-starter-data-jpa>
<spring-boot-devtools>3.3.x</spring-boot-devtools>
<lombok>1.18.x</lombok>

<!-- Market Data & Indicators -->
<ibapi>10.19.1</ibapi>
<ta4j-core>0.16</ta4j-core>

<!-- Persistence -->
<postgresql-driver>42.x.x</postgresql-driver>
<spring-data-jpa>3.3.x</spring-data-jpa>

<!-- Notifications -->
<telegrambots>6.8.0</telegrambots>

<!-- Monitoring (Phase 9) -->
<spring-boot-starter-actuator>3.3.x</spring-boot-starter-actuator>

<!-- Testing -->
<junit-jupiter>5.x.x</junit-jupiter>
<mockito>5.x.x</mockito>
<testcontainers>1.x.x</testcontainers>
```

### Error Handling & Logging Strategy

- Use SLF4J + Logback (auto-configured by Spring)
- Log levels: DEBUG (tick data), INFO (signals), ERROR (connection failures)
- Centralize exception handling: `@ControllerAdvice` for API errors
- Circuit breaker for IBKR disconnections: Resilience4j library (Phase 9)

### Configuration Externalization

- `application.properties` for dev defaults
- Environment variables for secrets: `TELEGRAM_BOT_TOKEN`, `DB_PASSWORD`, `IBKR_PORT`
- Spring Cloud Config for distributed configs (Optional, Phase 9)

### Testing Strategy

- Unit tests for indicator calculations (mock candle data)
- Integration tests for signal detection (in-memory DB)
- E2E test: Simulate IBKR ticks → verify Telegram call mocked
- Use TestContainers for PostgreSQL during CI/CD

---

## Summary

This is a comprehensive yet achievable implementation roadmap. The phases build incrementally from core infrastructure (Phase 0) through advanced features (Phases 8-9). Starting with **Milestone 1** gives you a working MVP in 2-3 weeks, then you can extend with additional signal types, multi-symbol scanning, persistence, and a web dashboard.

Key principles:
- **Modular design** — Each phase builds on previous ones
- **Loose coupling** — Use events for inter-service communication
- **Incremental delivery** — Deploy and test frequently
- **Production-ready** — Include error handling, logging, and monitoring from day one

