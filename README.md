# PKtradingIBKR

Trading signal platform: **Spring Boot** backend (IBKR, PostgreSQL, Telegram), **Angular** research/replay workspace (Phase 192), and **Flutter PK Live Trader** for live execution runtime.

> **Architecture & phases:** [PROJECT_INTELLIGENCE_README.md](PROJECT_INTELLIGENCE_README.md) · [docs/](docs/README.md)  
> **Trader terminology (canonical):** [docs/architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md](docs/architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md)

**Remote:** [github.com/krpsreddy/PKtradingIBKR](https://github.com/krpsreddy/PKtradingIBKR)

**Old laptop — full install:** [Windows](docs/OLD_LAPTOP_SETUP_GUIDE_WINDOWS.md) · [macOS](docs/OLD_LAPTOP_SETUP_GUIDE.md)

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | Java 21, Spring Boot 3.3, Maven, PostgreSQL, TA4J, IBKR API |
| Frontend | Angular 19 (research platform) · React live trader/screener · **Flutter mobile** (Phase 185) |
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

### Lightweight operational apps (not Angular)

| App | Path | Port |
|-----|------|------|
| Evolution backend | `./start-evolution.sh` (dev) or **`./run-production.sh`** (JAR) | **8180** |
| Evolution Angular (research) | dev: same script · prod: **`./run-frontend-prod.sh`** | **4300** |
| **1-click production** | `./build-production.sh` then `./run-production.sh` | JAR + static |
| **24/7 mobile only** | `./run-backend-only.sh` | **8180** only |
| React Live Trader | `frontend-live-trader/` | 4400 |
| React Live Screener | `frontend-live-screener/` | 4410 |
| **Flutter Mobile** | `pk-live-trader-mobile/` | device → 8180 |

See **[Mobile apps (Android & iOS)](#mobile-apps-android--ios)** below for build, USB, release, and Tailscale.

See [docs/phases/PHASE_185_FLUTTER.md](docs/phases/PHASE_185_FLUTTER.md) · [docs/MOBILE_REMOTE_TAILSCALE.md](docs/MOBILE_REMOTE_TAILSCALE.md).

---

## Mobile apps (Android & iOS)

**PK Live Trader** — Flutter app in `pk-live-trader-mobile/`. Polls evolution backend on **8180** (no trading logic on device).

### Prerequisites (once)

| Step | Command / action |
|------|------------------|
| Flutter + Android SDK | `./setup-mobile-dev.sh` |
| Mac shell env (optional) | `cat pk-live-trader-mobile/scripts/zshrc-snippet.sh >> ~/.zshrc` |
| Backend running | `./start-evolution.sh` (IB Gateway paper **4002**) |
| iOS: Xcode + signing | `./finish-ios-setup.sh` then `./setup-ios-signing.sh` (Team in Xcode) |
| iOS: device platform | `./setup-ios-platform.sh` if Xcode says *iOS X.X is not installed* |
| Away from home | `./setup-tailscale.sh` — Tailscale on **Mac + phone**, same account |

Copy endpoints (optional):

```bash
cp mobile.env.example mobile.env   # gitignored; edit LAN / Tailscale IPs
```

Default URLs baked into builds (override with env vars below):

| Mode | URL |
|------|-----|
| **Local** (home Wi‑Fi) | `http://<mac-lan-ip>:8180` e.g. `http://192.168.2.51:8180` |
| **Remote** (Tailscale) | `http://100.88.194.48:8180` (your Mac’s Tailscale IP) |

In-app **Local / Remote** switch (top-right) — no rebuild needed to change mode after install.

---

### Android

#### USB phone — run (debug, hot reload)

```bash
./start-evolution.sh                    # terminal 1 — backend
./start-mobile-android-phone.sh         # terminal 2 — USB device
```

Auto-detects phone, sets `adb reverse`, picks LAN URL. Same as:

```bash
./start-mobile-android.sh               # uses phone if USB connected, else emulator
```

Manual:

```bash
adb devices
cd pk-live-trader-mobile
flutter run -d <device-id> \
  --dart-define=LOCAL_API_BASE=http://$(ipconfig getifaddr en0):8180 \
  --dart-define=REMOTE_API_BASE=http://100.88.194.48:8180
```

**Phone:** Settings → Developer options → **USB debugging** ON → allow Mac.

#### Android emulator

```bash
./start-evolution.sh
./start-mobile-android.sh             # launches pk_trader emulator if needed
```

Emulator API default: `http://10.0.2.2:8180` (alias to Mac localhost).

#### Release APK (install from icon, no USB)

```bash
./build-mobile-apk.sh
```

Output:

`pk-live-trader-mobile/build/app/outputs/flutter-apk/app-release.apk`

Install:

```bash
adb install -r pk-live-trader-mobile/build/app/outputs/flutter-apk/app-release.apk
```

Custom URLs:

```bash
LOCAL_API_BASE=http://192.168.2.51:8180 \
REMOTE_API_BASE=http://100.88.194.48:8180 \
./build-mobile-apk.sh
```

#### Android — away from home (Tailscale)

Phone: Tailscale **ON**. Mac: `./start-evolution.sh` at home.

```bash
./start-mobile-remote.sh                # USB + Tailscale IP
# or build APK with Tailscale URL in mobile.env / REMOTE_API_BASE
```

---

### iPhone (iOS)

#### USB / wireless — run (debug)

> **Note:** iOS 14+ **debug** builds only open while Flutter/Xcode is attached. For home-screen launch, use [release install](#ios-release-home-screen) below.

```bash
./start-evolution.sh
./start-mobile-iphone.sh
```

Wireless device (same Wi‑Fi):

```bash
IOS_DEVICE=00008140-00015C1E1447001C ./start-mobile-iphone.sh
```

`flutter devices` lists IDs.

#### iOS release (home screen)

Build + install **release** — tap icon without Mac connected:

```bash
./install-ios-release.sh
```

Manual:

```bash
cd pk-live-trader-mobile
LAN=$(ipconfig getifaddr en0)
flutter build ios --release \
  --dart-define=LOCAL_API_BASE=http://${LAN}:8180 \
  --dart-define=REMOTE_API_BASE=http://100.88.194.48:8180
flutter install --release -d <iphone-device-id>
```

**First install on device:** Settings → General → **VPN & Device Management** → Trust developer.

#### iOS — away from home (Tailscale)

Tailscale **ON** on iPhone → in app switch to **Remote** (`100.88.194.48:8180`).

Rebuild release only if Tailscale IP changes:

```bash
REMOTE_API_BASE=http://100.88.194.48:8180 ./install-ios-release.sh
```

---

### Mobile scripts reference

| Script | Purpose |
|--------|---------|
| `setup-mobile-dev.sh` | Flutter, Android SDK, emulator `pk_trader` |
| `setup-tailscale.sh` | Tailscale install hints + IP check |
| `setup-ios-signing.sh` | Open Xcode — Apple ID / Team / signing |
| `setup-ios-platform.sh` | Download iOS platform (`xcodebuild -downloadPlatform iOS`) |
| `finish-ios-setup.sh` | Post–Xcode install (license, `flutter doctor`) |
| `start-evolution.sh` | Backend **8180** + Angular research UI **4300** (home + replay lab; live debug optional) |
| `start-mobile-android.sh` | Android emulator or auto USB phone |
| `start-mobile-android-phone.sh` | USB Android only |
| `start-mobile-remote.sh` | USB + Tailscale remote URL |
| `start-mobile-iphone.sh` | iPhone debug via Flutter |
| `build-mobile-apk.sh` | Android **release APK** |
| `install-ios-release.sh` | iPhone **release** — home screen launch |
| `scripts/detect-mobile-api-base.sh` | Print URL phone can reach (LAN vs Tailscale) |
| `scripts/tailscale-api-base.sh` | Print `http://<tailscale-ip>:8180` |

Config: `mobile.env.example` → `mobile.env` (gitignored).

IDE: **Cursor** with **Dart** + **Flutter** extensions; open `pk-live-trader-mobile/`.

---

### Mobile troubleshooting

| Issue | Fix |
|-------|-----|
| Android “not connected” | Same Wi‑Fi as Mac, or `adb reverse tcp:8180 tcp:8180` |
| `100.88.194.48` fails | Tailscale OFF on phone — turn ON (same account as Mac) |
| Local fails | `ipconfig getifaddr en0` changed — update `mobile.env` / rebuild |
| Switch spins forever | Use latest app; force-close and reopen; or `./install-ios-release.sh` |
| iPhone Local fails / errno 65 | Tailscale on iPhone blocks LAN — use **Remote**, or app auto-falls back to Tailscale (`Local·TS`) |
| iPhone Local fails | iOS **Local Network** prompt → Allow; same Wi‑Fi as Mac |
| iPhone both modes fail | Reinstall: `./install-ios-release.sh` (needs Local Network in Info.plist) |
| iOS debug won’t open from icon | Normal — use `./install-ios-release.sh` |
| *iOS 26.x is not installed* | `./setup-ios-platform.sh` |
| No signing certificate | `./setup-ios-signing.sh` → Team in Xcode |
| Xcode license | `sudo xcodebuild -license accept` |

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
  frontend/src/app/               # Angular research dashboard
  frontend-live-trader/           # React operational terminal
  pk-live-trader-mobile/          # Flutter mobile terminal (Phase 185)
  mobile.env.example              # LAN + Tailscale URLs for mobile scripts
  build-mobile-apk.sh             # Android release APK
  install-ios-release.sh          # iPhone release install
  docs/                           # Intelligence & phase docs
  dev/ngrok/                      # Local tunnel helpers (secrets gitignored)
```

---

## License

Private / personal trading research project. Do not commit `application-local.properties`, Telegram tokens, or `dev/ngrok/.env`.
