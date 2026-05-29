# Old Laptop — Full Setup Guide (PKtradingIBKR) — macOS

> **Windows laptop?** Use **[OLD_LAPTOP_SETUP_GUIDE_WINDOWS.md](OLD_LAPTOP_SETUP_GUIDE_WINDOWS.md)**  
> PowerShell: `start-paper.ps1`, `start-live.ps1`, `start-all.ps1`, `stop-backends.ps1`

**Use this file on your old laptop (Mac)** to install every dependency and run the platform from scratch.

**Also read:** [SESSION_HANDOFF.md](SESSION_HANDOFF.md) · [PHASE_221_DUAL_RUNTIME_ARCHITECTURE.md](phases/PHASE_221_DUAL_RUNTIME_ARCHITECTURE.md) · [DEPLOY_QUICKSTART.md](DEPLOY_QUICKSTART.md)

---

## Table of contents

1. [Install order (checklist)](#1-install-order-checklist)
2. [What you are installing](#2-what-you-are-installing)
3. [macOS tools (Homebrew)](#3-macos-tools-homebrew)
4. [Java 21 + Maven](#4-java-21--maven)
5. [PostgreSQL + database](#5-postgresql--database)
6. [Get the project](#6-get-the-project)
7. [IBKR TWS API JAR](#7-ibkr-tws-api-jar)
8. [Secrets & config](#8-secrets--config)
9. [IBKR Gateway](#9-ibkr-gateway)
10. [Run backend](#10-run-backend)
11. [Flutter mobile](#11-flutter-mobile)
12. [Angular frontend (optional)](#12-angular-frontend-optional)
13. [TradingView webhook (optional)](#13-tradingview-webhook-optional)
14. [Copy from your main Mac (USB)](#14-copy-from-your-main-mac-usb)
15. [Daily startup](#15-daily-startup)
16. [Troubleshooting](#16-troubleshooting)
17. [Command cheat sheet](#17-command-cheat-sheet)

---

## 1. Install order (checklist)

Do these **in order** on the old laptop:

| Step | What | Section |
|------|------|---------|
| ☐ 1 | Homebrew + Xcode CLI tools | §3 |
| ☐ 2 | Git | §3 |
| ☐ 3 | Java 21 + Maven | §4 |
| ☐ 4 | PostgreSQL + `trading_signals` DB + password | §5 |
| ☐ 5 | Clone or copy project folder | §6 |
| ☐ 6 | `lib/TwsApi.jar` + `mvn compile` | §7 |
| ☐ 7 | `application-local.properties` | §8 |
| ☐ 8 | IBKR Gateway (paper 4002, live 4001) | §9 |
| ☐ 9 | `./start-paper.sh` or `./start-all.sh` | §10 |
| ☐ 10 | (Optional) Flutter + phone | §11 |
| ☐ 11 | (Optional) Node + Angular | §12 |

---

## 2. What you are installing

| Component | Purpose |
|-----------|---------|
| **Java 21** | Spring Boot backend |
| **Maven** | Build backend |
| **PostgreSQL** | Candles, paper trades, signals |
| **IBKR Gateway** | Market data (paper + live) |
| **`lib/TwsApi.jar`** | IB API (not on Maven Central) |
| **Flutter** (optional) | Android / iPhone app |
| **Node.js** (optional) | Angular research UI port 4300 |

**Dual runtime (Phase 221):**

| Runtime | Backend | IB Gateway | Client ID | Data | Mobile default |
|---------|---------|------------|-----------|------|----------------|
| **PAPER** | `8180` | `4002` | `101` | Delayed (type 3) | Android |
| **LIVE** | `8080` | `4001` | `201` | Live (type 1) | iPhone |

---

## 3. macOS tools (Homebrew)

### 3.1 Install Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Apple Silicon** — add to `~/.zshrc` (installer shows exact path):

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc
```

**Intel Mac** — usually `/usr/local/bin/brew`.

### 3.2 Xcode Command Line Tools

```bash
xcode-select --install
```

For **iPhone** later: install full **Xcode** from the App Store.

### 3.3 Git

```bash
brew install git
git --version
```

### 3.4 Optional helpers

```bash
brew install jq          # pretty JSON for curl checks
brew install curl        # usually preinstalled on macOS
```

---

## 4. Java 21 + Maven

```bash
brew install openjdk@21 maven
```

Add to `~/.zshrc`:

```bash
cat >> ~/.zshrc <<'EOF'
export JAVA_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || echo /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home)"
export PATH="$JAVA_HOME/bin:$PATH"
EOF
source ~/.zshrc
```

**Intel Mac** — if `java_home` fails:

```bash
export JAVA_HOME="/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
```

Verify:

```bash
java -version
mvn -version
```

---

## 5. PostgreSQL + database

### 5.1 Install and start

```bash
brew install postgresql@16
brew services start postgresql@16
```

Add to `~/.zshrc`:

```bash
cat >> ~/.zshrc <<'EOF'
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
EOF
source ~/.zshrc
```

Intel:

```bash
export PATH="/usr/local/opt/postgresql@16/bin:$PATH"
```

### 5.2 Create database

```bash
cd /path/to/pktradingIBKR
chmod +x scripts/setup-postgres.sh
./scripts/setup-postgres.sh
```

Or manually:

```bash
createdb trading_signals
```

### 5.3 Set DB password (match your main machine)

```bash
cd /path/to/pktradingIBKR
cp src/main/resources/application-local.properties.example src/main/resources/application-local.properties
```

Edit `src/main/resources/application-local.properties`:

```properties
spring.datasource.password=Kpr1412@postgres
# Uncomment if DB user is postgres, not your Mac login name:
# spring.datasource.username=postgres
```

Apply password in PostgreSQL:

```bash
psql postgres -c "ALTER USER $(whoami) PASSWORD 'Kpr1412@postgres';"
# or if you use role postgres:
psql postgres -c "ALTER USER postgres PASSWORD 'Kpr1412@postgres';"
```

Test:

```bash
psql -d trading_signals -c "SELECT 1;"
```

---

## 6. Get the project

### Option A — Git clone

```bash
mkdir -p ~/IdeaProjects
cd ~/IdeaProjects
git clone https://github.com/krpsreddy/PKtradingIBKR.git
cd PKtradingIBKR
```

### Option B — Copy from USB / AirDrop

Copy the whole `pktradingIBKR` folder to e.g. `~/IdeaProjects/pktradingIBKR`.

**Important:** Also copy from your working Mac:

- `lib/TwsApi.jar` (required — see §7)
- `src/main/resources/application-local.properties` (secrets — do not publish)

```bash
cd ~/IdeaProjects/pktradingIBKR
chmod +x *.sh scripts/*.sh setup-*.sh 2>/dev/null || true
```

---

## 7. IBKR TWS API JAR

Build **fails** without this file: `lib/TwsApi.jar`

### Download (if you do not have the JAR)

1. https://interactivebrokers.github.io  
2. Download **TWS API** for your OS  
3. Find `TwsApi.jar` (often `source/JavaClient/TwsApi.jar` in the SDK zip)

### Install into project

```bash
cd /path/to/pktradingIBKR
mkdir -p lib
cp /path/to/downloaded/TwsApi.jar lib/TwsApi.jar
```

Optional — project script:

```bash
./scripts/install-ib-api.sh /path/to/TwsApi.jar
cp /path/to/TwsApi.jar lib/TwsApi.jar
```

### Verify compile

```bash
cd /path/to/pktradingIBKR
mvn -q compile -DskipTests
```

If this succeeds, backend dependencies are OK.

---

## 8. Secrets & config

Minimum file: `src/main/resources/application-local.properties` (gitignored)

```properties
spring.datasource.password=Kpr1412@postgres
```

Optional — Telegram (or use env vars):

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"
```

Optional env overrides:

```bash
export DB_PASSWORD='Kpr1412@postgres'
export DB_USERNAME=pk
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=trading_signals
```

Profile-specific settings are already in:

- `src/main/resources/application-paper.properties`
- `src/main/resources/application-live.properties`

---

## 9. IBKR Gateway

1. Download and install **IB Gateway** from Interactive Brokers.  
2. Log in (paper account for 4002, live for 4001).  
3. **Configure → Settings → API → Settings:**
   - ☑ **Enable ActiveX and Socket Clients**
   - ☑ **Enable delayed market data** (required for paper / type 3)
   - Socket port **4002** (paper gateway instance)
   - Separate live gateway on **4001** if running dual runtime
4. Keep Gateway running while the backend runs.

**Two gateways:** run paper and live gateways together for `./start-all.sh`.

---

## 10. Run backend

### 10.1 Dual runtime (recommended)

```bash
cd /path/to/pktradingIBKR
mkdir -p logs

./start-paper.sh      # port 8180 → logs/paper-runtime.log
./start-live.sh       # port 8080 → logs/live-runtime.log
./start-all.sh        # both
```

### 10.2 Development (foreground, see logs)

```bash
export SPRING_PROFILES_ACTIVE=paper
mvn -q compile spring-boot:run
```

```bash
export SPRING_PROFILES_ACTIVE=live
mvn -q compile spring-boot:run
```

Legacy (paper + Angular dev UI):

```bash
./start-evolution.sh
```

### 10.3 Production (24/7, no Maven at runtime)

One-time on a machine that builds:

```bash
./build-production.sh
```

On old laptop:

```bash
./run-backend-only.sh
# Paper gateway:
IBKR_PORT=4002 ./run-backend-only.sh
```

### 10.4 Verify

```bash
curl -s http://localhost:8180/api/runtime/profile | python3 -m json.tool
curl -s http://localhost:8180/api/live-trader/stream-debug | python3 -m json.tool
curl -s http://localhost:8080/api/runtime/profile | python3 -m json.tool
```

**Healthy paper stream:** `ibkrStreaming: true`, `symbolsStreaming` > 0, `marketDataEntitlementErrors: 0`.

### 10.5 Logs

```bash
tail -f logs/paper-runtime.log
grep ' ERROR ' logs/paper-runtime.log
```

Stop backends:

```bash
pkill -f TradingBotApplication
lsof -t -i:8180 | xargs kill -9 2>/dev/null
lsof -t -i:8080 | xargs kill -9 2>/dev/null
```

---

## 11. Flutter mobile

### 11.1 One-time

```bash
cd /path/to/pktradingIBKR
./setup-mobile-dev.sh
cat pk-live-trader-mobile/scripts/zshrc-snippet.sh >> ~/.zshrc
source ~/.zshrc
flutter doctor
```

### 11.2 LAN IP (real phone on Wi‑Fi)

```bash
ipconfig getifaddr en0
cp mobile.env.example mobile.env
# Edit PK_LAN_IP=192.168.x.x
```

### 11.3 Android USB

Terminal 1:

```bash
./start-paper.sh
```

Terminal 2:

```bash
./start-mobile-android-phone.sh
```

Enable **USB debugging** on the phone.

### 11.4 Android emulator

```bash
./start-paper.sh
./start-mobile-android.sh
```

Emulator reaches Mac via `http://10.0.2.2:8180`.

### 11.5 iPhone

```bash
./finish-ios-setup.sh
./setup-ios-signing.sh
./start-live.sh
./start-mobile-iphone.sh
```

In app: **PAPER / LIVE** toggle. iOS defaults to LIVE `:8080`.

### 11.6 Release APK

```bash
./build-mobile-apk.sh
adb install -r pk-live-trader-mobile/build/app/outputs/flutter-apk/app-release.apk
```

With your Mac LAN IP:

```bash
LOCAL_API_BASE=http://192.168.x.x:8180 ./build-mobile-apk.sh
```

### 11.7 Tailscale (away from home)

```bash
./setup-tailscale.sh
./start-paper.sh
./start-mobile-remote.sh
```

---

## 12. Angular frontend (optional)

```bash
brew install node@20
cd /path/to/pktradingIBKR/frontend
npm install
npm start
```

With evolution dev stack:

```bash
./start-evolution.sh
```

Open: http://localhost:4300

---

## 13. TradingView webhook (optional)

Backend on paper port 8180. TradingView alert URL:

```text
http://<mac-lan-ip>:8180/api/tradingview/webhook
```

Pine: `scripts/tradingview/PK_Autonomous_Intelligence_Engine.pine`  
Doc: [phases/PHASE_218_PINE_AUTONOMOUS_INTELLIGENCE_ENGINE.md](phases/PHASE_218_PINE_AUTONOMOUS_INTELLIGENCE_ENGINE.md)

---

## 14. Copy from your main Mac (USB)

If the **old laptop is slower**, build on the main Mac and copy:

| Copy this | To old laptop |
|-----------|----------------|
| Whole repo OR `target/pktradingIBKR-1.0.0-SNAPSHOT.jar` | Same path |
| `lib/TwsApi.jar` | `lib/TwsApi.jar` |
| `application-local.properties` | `src/main/resources/` |
| `application-paper.properties` | `src/main/resources/` |
| `application-live.properties` | `src/main/resources/` |
| `start-paper.sh`, `start-live.sh`, `start-all.sh` | repo root |

On old laptop install only:

```bash
brew install openjdk@21 postgresql@16
brew services start postgresql@16
# IB Gateway + application-local.properties
./start-paper.sh
```

---

## 15. Daily startup

```bash
brew services start postgresql@16
# Start IB Gateway (paper 4002 / live 4001)
cd ~/IdeaProjects/pktradingIBKR
./start-all.sh
curl -s http://localhost:8180/api/live-trader/stream-debug
# Optional phone:
./start-mobile-android-phone.sh
```

---

## 16. Troubleshooting

| Problem | Fix |
|---------|-----|
| `mvn compile` / `com.ib:client` error | Add `lib/TwsApi.jar` (§7) |
| DB auth failed | Password in `application-local.properties` + `ALTER USER` in psql |
| IBKR **10168** | Enable **delayed market data** in Gateway; paper uses type 3 |
| `ibkrStreaming: false` | Gateway down, wrong port, or no data entitlement |
| IBKR **326** client id in use | `pkill -f TradingBotApplication`; use client 101/201 |
| Phone cannot reach API | Same Wi‑Fi, correct IP, or Tailscale |
| Port in use | `lsof -i :8180` then `kill -9 <pid>` |
| iOS build error | `cd pk-live-trader-mobile && flutter analyze` |

Mac LAN IP:

```bash
ipconfig getifaddr en0
```

---

## 17. Command cheat sheet

```bash
# ========== INSTALL ONCE ==========
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
xcode-select --install
brew install git openjdk@21 maven postgresql@16 jq
brew install --cask flutter          # mobile
brew install node@20                 # optional Angular

# Java (~/.zshrc)
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
export PATH="$JAVA_HOME/bin:$PATH"

# Postgres PATH (~/.zshrc)
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# ========== PROJECT ==========
cd ~/IdeaProjects
git clone https://github.com/krpsreddy/PKtradingIBKR.git
cd PKtradingIBKR
chmod +x *.sh scripts/*.sh setup-*.sh 2>/dev/null || true

# ========== DATABASE ==========
brew services start postgresql@16
./scripts/setup-postgres.sh
cp src/main/resources/application-local.properties.example src/main/resources/application-local.properties
# Edit password in application-local.properties
psql postgres -c "ALTER USER $(whoami) PASSWORD 'Kpr1412@postgres';"

# ========== IB API ==========
mkdir -p lib
cp /path/to/TwsApi.jar lib/TwsApi.jar
mvn -q compile -DskipTests

# ========== RUN ==========
./start-paper.sh
./start-live.sh
./start-all.sh

# ========== VERIFY ==========
curl -s http://localhost:8180/api/runtime/profile
curl -s http://localhost:8180/api/live-trader/stream-debug

# ========== MOBILE ==========
./setup-mobile-dev.sh
./start-mobile-android-phone.sh
./start-mobile-iphone.sh

# ========== LOGS / STOP ==========
tail -f logs/paper-runtime.log
grep ' ERROR ' logs/paper-runtime.log
pkill -f TradingBotApplication
```

---

## Security

- Never commit `application-local.properties`.
- Do not share DB passwords or Telegram tokens.
- LIVE runtime blocks auto paper by design — keep `RuntimeExecutionSafetyGuard` enabled.

---

*Last updated: Phase 221 dual runtime, stream fixes, DB local config, mobile PAPER/LIVE.*
