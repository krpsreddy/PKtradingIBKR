# PKtradingIBKR

Trading signal platform: **Spring Boot** backend (IBKR, PostgreSQL, Telegram) and **Angular** execution dashboard (autonomous scanner, dominant opportunity engine, replay intelligence).

> **Architecture & phases:** [PROJECT_INTELLIGENCE_README.md](PROJECT_INTELLIGENCE_README.md) · [docs/](docs/README.md)

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

## Autonomous execution terminology (source of truth)

Trader-facing labels come from **multiple mappers** in the frontend — not one global dictionary. This section documents **exact strings** and **source files** for live trading.

### How labels reach the screen

| Surface | Primary source | Display transform |
|--------|----------------|-------------------|
| Dominant hero state | `DominantOpportunityState` | `formatLabel()` → `_` → space |
| Dominant hero regime | `regimeGroupForType()` | Strips `"High Conviction "` prefix |
| Scanner badges | `badgeForType()` | Emoji + fixed text |
| Scanner live state (sidebar) | `STATE_LABELS` | Title case |
| Execution plans / family | `CANONICAL_REGIME_LABELS` | `formatCanonicalRegimeLabel()` |
| Legacy signal → regime | `REGIME_LABELS` | `formatAutonomousRegime()` |
| Card primary action | `deriveDominantAction()` | `primaryLabel` / `secondaryLabel` |
| Live execution rail | `LiveDecisionEngine.decisionDisplay()` | Spaces from `_` |
| Trigger overlay | `TraderExecutionAction` | `actionLabel()` → `replace(/_/g, ' ')` |
| Exit on plan | `TemplateExitEngine` + `AdaptiveExitState` | Fixed strings or spaced enums |

**Key files:** `frontend/src/app/utils/autonomous-terminology.util.ts`, `cluster-family.models.ts`, `scanner-ranking.engine.ts`, `scanner-state.engine.ts`, `action-dominance.engine.ts`, `live-decision-engine.ts`, `template-exit.engine.ts`, `execution-trigger-synthesis.service.ts`

---

### 1. Canonical execution regimes (plans, templates)

**Source:** `cluster-family.models.ts` (`CANONICAL_REGIME_LABELS`), `template-registry.service.ts`

| Internal ID | UI text | Template meaning (code) | Trader bias (code) |
|-------------|---------|-------------------------|-------------------|
| `EARLY_EXPANSION` | Early Expansion | Aggressive momentum entry; wider vol stop | ENTER; exit: `TRAILING CONTINUATION HOLD` |
| `INSTITUTIONAL_PERSISTENCE` | Institutional Persistence | Shallow pullback / hold band | ENTER/ADD; persistence override eligible |
| `VWAP_ACCEPTANCE` | VWAP Acceptance | Reclaim at VWAP; VWAP loss invalidation | ENTER |
| `SHALLOW_PULLBACK_CONTINUATION` | Healthy Pullback Continuation | Pullback zone entry | ENTER/ADD on PB |
| `COMPRESSION_BREAKOUT` | Compression Breakout | Breakout above compression | ENTER |
| `HEALTHY_EXTENSION` | Healthy Extension | Reduced-size continuation; tighter invalidation | ENTER reduced size |
| `EXHAUSTION_DRIFT` | Exhaustion Drift | No new entry; trim/exit priority | `allowsEntry: false`; `EXIT PRIORITY` |
| `PERSISTENT_CONTINUATION` | Persistent Continuation | Confirmed trend participation | ENTER; `TRAILING CONTINUATION HOLD` |

Family overlay lines (`cluster-family-overlay.engine.ts`): `{displayLabel} · score boost +N`, `{displayLabel} · family confidence N%`.

**Lifecycle bias (internal):** `ENTER` \| `ADD` \| `WATCH` \| `AVOID` \| `EXIT` (`cluster-family-mapper.engine.ts`).

---

### 2. Autonomous opportunity types (scanner / feed / cards)

**Source:** `autonomous-regime-scanner.models.ts`, `scanner-ranking.engine.ts`, `autonomous-terminology.util.ts`

| Internal ID | UI label | Scanner badge (exact) | Section / hero regime | Default action |
|-------------|----------|----------------------|----------------------|----------------|
| `EARLY_CONTINUATION` | Early Continuation | 🟢 HIGH CONTINUATION | Continuations | `ENTER` |
| `INSTITUTIONAL_ACCELERATION` | Institutional Acceleration | 🟢 INSTITUTIONAL PERSISTENCE | Institutional Persistence | `ENTER` |
| `SHALLOW_PULLBACK_CONTINUATION` | Healthy Pullback Continuation | 🟡 HEALTHY PULLBACK | Healthy Shallow Pullbacks | `ENTER` |
| `VWAP_PERSISTENCE` | VWAP Persistence | 🟢 VWAP PERSISTENCE | VWAP Acceptance | `ENTER` |
| `COMPRESSION_RELEASE` | Compression Release | 🟢 COMPRESSION BREAKOUT | Compression Breakouts | `ENTER` |
| `TREND_RESUMPTION` | Trend Resumption | 🟠 LATE EXTENSION | Trend Resumption | `ENTER` |
| `LATE_STAGE_EXHAUSTION` | Late-Stage Exhaustion | 🔴 EXHAUSTION DEVELOPING | Exhaustion / Do Not Chase | `AVOID` |

Sidebar action chip: raw `ENTER` \| `WATCH` \| `ADD` \| `AVOID` \| `EXIT` (`actionChipLabel`).

---

### 3. Scanner live state (sidebar)

**Source:** `scanner-state.engine.ts`

| Internal ID | UI text | When |
|-------------|---------|------|
| `EARLY_EXPANSION` | Early Expansion | Early continuation + rising |
| `PERSISTENT_CONTINUATION` | Persistent Continuation | Default / institutional accel |
| `HEALTHY_PULLBACK` | Healthy Pullback | Shallow PB type |
| `VWAP_ACCEPTANCE` | VWAP Acceptance | VWAP persistence |
| `COMPRESSION_READY` | **Compression Ready** | Compression release (not “Breakout”) |
| `LATE_EXTENSION` | Late Extension | Trend resumption |
| `EXHAUSTION_DRIFT` | Exhaustion Drift | Exhaustion elevated |
| `REGIME_BREAKDOWN` | Regime Breakdown | AVOID or exhaustion ≥ 75 |

---

### 4. Dominant opportunity states (hero)

**Source:** `dominant-opportunity.service.ts` — displayed via `formatLabel(state)` → e.g. **DOMINANT NOW**, **DEGRADING**

| Internal ID | UI text | When |
|-------------|---------|------|
| `DOMINANT_NOW` | DOMINANT NOW | Top rank; badge `DOMINANT` |
| `EMERGING_FAST` | EMERGING FAST | Fast conviction delta; row **EMERGING FASTEST** |
| `INSTITUTIONAL_FLOW` | INSTITUTIONAL FLOW | High institutional score |
| `SECOND_LEG_DOMINANCE` | SECOND LEG DOMINANCE | Trend resumption + expansion |
| `PERSISTENCE_LEADER` | PERSISTENCE LEADER | High continuation score |
| `WATCHLIST_READY` | WATCHLIST READY | Default / WATCH |
| `DEGRADING` | DEGRADING | Exhaustion + low velocity or negative delta |
| `EXHAUSTING` | EXHAUSTING | Exhaustion ≥ 58 or AVOID |

**Persistence tier:** `ELITE` \| `STRONG` \| `MODERATE` \| `WEAK`. **Institutional:** `HIGH` \| `MEDIUM` \| `LOW`.

---

### 5. Phase 168 regime ontology (legacy signal map)

**Source:** `autonomous-terminology.util.ts`

| Internal ID | UI text | Legacy signals |
|-------------|---------|----------------|
| `EARLY_EXPANSION` | Early Expansion | OPEN_MOM*, IMBALANCE_UP |
| `PERSISTENT_CONTINUATION` | Persistent Continuation | MOM_BUY, CONT_* |
| `FAILED_EXPANSION` | Failed Expansion | OPEN_FAIL*, RECOVERY_FAIL, IMBALANCE_DOWN |
| `VWAP_ACCEPTANCE` | VWAP Acceptance | VWAP_RECLAIM |
| `SHALLOW_PULLBACK_CONTINUATION` | Healthy Pullback Continuation | PULL_BUY |
| `EXHAUSTION_DRIFT` | Exhaustion Drift | EXIT |

---

### 6. Live execution decisions (execution panel)

**Source:** `live-decision-engine.ts`

| Internal ID | UI text |
|-------------|---------|
| `FULL_EXECUTION` | FULL EXECUTION |
| `PROBING_EXECUTION` | PROBING EXECUTION |
| `WAIT_FOR_ACCEPTANCE` | WAIT FOR ACCEPTANCE |
| `WAIT_FOR_PULLBACK` | WAIT FOR PULLBACK |
| `REDUCE_SIZE` | REDUCE SIZE |
| `AVOID_CHASE` | AVOID CHASE |
| `AVOID_TRADE` | AVOID TRADE |
| `TRAP_RISK` | TRAP RISK |

**Risk labels:** `Weak breadth risk`, `High fakeout risk`, `Extension risk elevated`, etc. (`live-decision.util.ts`).

---

### 7. Execution trigger overlay

**Source:** `execution-trigger.models.ts`, `execution-trigger.util.ts`

| Trader action (UI) | Marker |
|--------------------|--------|
| EARLY CONTINUATION ENTRY | CONT ENTRY |
| HEALTHY SHALLOW PULLBACK | SHALLOW PB |
| VWAP HOLD CONTINUATION | VWAP HOLD |
| ADD ON COMPRESSION BREAKOUT | COMPRESS / ORB ADD |
| TREND RESUMPTION READY | RESUME |
| DO NOT CHASE / LATE STAGE EXHAUSTION | (exhaustion path) |

Chart zones: `CONTINUATION_ENTRY`, `SHALLOW_PULLBACK_HOLD`, `COMPRESSION_BREAKOUT`, `VWAP_PERSISTENCE`, `EXTENSION_WARNING`, `EXHAUSTION_DEVELOPING`.

---

### 8. Template exit labels (AUTONOMOUS_TEMPLATE)

**Source:** `template-exit.engine.ts`

| Condition | Exact `exitLabel` |
|-----------|-------------------|
| `EXHAUSTION_DRIFT` | `EXIT PRIORITY` |
| Exhausting, no persistence override | `REDUCE ON EXHAUSTION` |
| Extended + override | `TRAIL CONTINUATION · HOLD PERSISTENCE` |
| Extended, no override | `TRAIL CONTINUATION · REDUCE ON STALL` |
| Persistence regimes | `TRAILING CONTINUATION HOLD` |
| Developing / confirming | `HOLD — AWAIT CONFIRMATION` |
| Default | `HOLD` |

**Adaptive exit:** `HOLD`, `SCALE_PARTIAL`, `TAKE_PROFIT`, `EXIT_SOON`, `EXIT_NOW` (`probabilistic.model.ts`).

---

### 9. Dominant action labels (cards / feed)

**Source:** `action-dominance.engine.ts`

| Primary | Secondary |
|---------|-----------|
| ENTER NOW | ADD ON PB / WAIT FOR ACCEPTANCE |
| ADD ON PB | REDUCE EXTENSION / HOLD TRAIL |
| REDUCE EXTENSION | HOLD TRAIL |
| WAIT FOR ACCEPTANCE | HOLD STRUCTURE |
| HOLD STRUCTURE | WAIT FOR ACCEPTANCE |
| EXIT WEAKENING | REDUCE EXTENSION |
| AVOID CHOP | EXIT WEAKENING |

---

### 10. Execution quality compact lines

**Source:** `execution-quality-synthesis.service.ts`

Examples: `IDEAL · LOW FAKEOUT · FULL EDGE`, `EXHAUSTION RISK · THIRD LEG EXTENDED · …`, `TRAP RISK · WEAK BREADTH · …`, `CHASE RISK · REDUCE SIZE · …`.

---

### 11. Lifecycle bar (enriched cards)

**Source:** `execution-lifecycle.engine.ts` — stages shown as spaced IDs:

`DEVELOPING` → `EARLY EXPANSION` → `PERSISTENCE` → `SHALLOW PB` → `CONFIRMED` → `ADD` → `EXTENDED` → `EXHAUSTING` → `FAILED`

---

### Naming mismatches (live trading)

| You might expect | Code shows |
|------------------|------------|
| Healthy Shallow Pullback | Group: **Healthy Shallow Pullbacks**; canonical: **Healthy Pullback Continuation**; badge: **HEALTHY PULLBACK** |
| Compression Breakout | Live state often **Compression Ready** |
| Failed Expansion | `FAILED_EXPANSION` in terminology util; scanner uses **EXHAUSTION DEVELOPING** |
| Ready | Closest: `WATCHLIST_READY`, `TREND RESUMPTION READY`, `COMPRESSION READY` |

---

## Trader cheat sheet (from code + validation logic)

### Best entry labels

`ENTER NOW`, `FULL EXECUTION`, `PROBING EXECUTION`, `EARLY CONTINUATION ENTRY`, `HEALTHY SHALLOW PULLBACK`, `VWAP HOLD CONTINUATION`, scanner badges 🟢 HIGH CONTINUATION / INSTITUTIONAL PERSISTENCE, hero **DOMINANT NOW**, quality `IDEAL · … · FULL EDGE`.

### Best hold labels

`TRAILING CONTINUATION HOLD`, `TRAIL CONTINUATION · HOLD PERSISTENCE`, `HOLD STRUCTURE`, persistence **ELITE**/**STRONG**, adaptive `HOLD`.

### Best exit / trim labels

`REDUCE ON EXHAUSTION`, `REDUCE EXTENSION`, `EXIT WEAKENING`, `REDUCE SIZE`, `SCALE_PARTIAL`, `TAKE_PROFIT`, `EXIT NOW`.

### Danger labels

`EXHAUSTION RISK · THIRD LEG EXTENDED`, `TRAP RISK`, `CHASE RISK · REDUCE SIZE`, chart `EXHAUSTION_DEVELOPING` / `EXTENSION_WARNING`, hero **EXHAUSTING** / **DEGRADING**.

### Avoid labels

`AVOID CHOP`, `AVOID TRADE`, `AVOID CHASE`, `DO NOT CHASE`, `LATE_STAGE_EXHAUSTION`, scanner `AVOID`, `Exhaustion guard — no parabolic chase`, **Weak breadth risk**.

### Exit validation research (Phase 180)

Advisory hybrid routing strings in `exit-intelligence-validation.engine.ts` — e.g. delayed exhaustion on `EARLY_EXPANSION`, persistence override on `INSTITUTIONAL_PERSISTENCE`. Tab: **Autonomous Discovery Lab → Exit Intelligence Validation**.

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
