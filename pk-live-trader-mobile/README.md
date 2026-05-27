# PK Mobile Live Trader + Live Scanner (Phase 185)

Lightweight **Flutter** operational terminal — separate from the Angular research platform.

## Architecture

```
IBKR live ticks → Spring Boot (8180 evolution) → Scanner / Dominance / Live Trader APIs → Flutter app
```

- **No** intelligence logic in Flutter — display + controls only.
- **Paper execution** via internal simulation (`PAPER_RESEARCH`); live IBKR prices from `/api/quotes`.
- **No** Finnhub / Polygon / Yahoo.

## Prerequisites

- Flutter SDK 3.16+ (`brew install --cask flutter`)
- Android SDK (installed via Homebrew on this machine — see below)
- Evolution backend: `./start-evolution.sh` (port **8180**)
- IB Gateway paper on **4002**

## Quick start (from repo root)

```bash
./setup-mobile-dev.sh      # once: verify tools + emulator
./start-evolution.sh       # terminal 1 — backend
./start-mobile-android.sh       # emulator (or auto-detects USB phone)
./start-mobile-android-phone.sh # USB Android phone only
```

## Installable APK (Android)

```bash
./build-mobile-apk.sh
# Physical phone on Wi‑Fi (replace with your Mac IP):
API_BASE=http://192.168.x.x:8180 ./build-mobile-apk.sh
```

Output: `pk-live-trader-mobile/build/app/outputs/flutter-apk/app-release.apk`

```bash
adb install -r pk-live-trader-mobile/build/app/outputs/flutter-apk/app-release.apk
```

Default build uses `http://10.0.2.2:8180` (Android emulator → Mac localhost). Rebuild with your LAN IP for a real phone.

iPhone later: install **Xcode** → `./finish-ios-setup.sh` → `./start-mobile-iphone.sh`

## Local / Remote switch (in app)

Top-right toggle: **Local** = home LAN (`192.168.2.25:8180`), **Remote** = Tailscale (`100.88.194.48:8180`). Choice is saved on the phone — no rebuild needed.

Build with both URLs baked in:

```bash
flutter run --dart-define=LOCAL_API_BASE=http://192.168.2.25:8180 \
  --dart-define=REMOTE_API_BASE=http://100.88.194.48:8180
```

## Away from home (Tailscale)

```bash
./setup-tailscale.sh           # once: Mac + phone Tailscale, same account
./start-evolution.sh           # Mac at home
./start-mobile-remote.sh       # phone anywhere (uses Mac Tailscale IP)
```

See `docs/MOBILE_REMOTE_TAILSCALE.md`.

## Cursor (no VS Code required)

Cursor is VS Code–based. Install extensions in Cursor:

- **Dart**
- **Flutter**

Open folder `pk-live-trader-mobile`, pick device (iPhone / Android / emulator), press **F5** or use Run → select a launch config from `.vscode/launch.json`.

## Android SDK (already installed via Homebrew)

```bash
flutter doctor   # Android toolchain should show ✓
```

If a new terminal doesn’t find `sdkmanager`, add to `~/.zshrc`:

```bash
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export JAVA_HOME="/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
```

## Run

```bash
cd pk-live-trader-mobile
flutter pub get

# Android emulator → Mac backend (special alias 10.0.2.2)
flutter run --dart-define=API_BASE=http://10.0.2.2:8180

# Physical Android phone (same Wi‑Fi as Mac)
flutter run --dart-define=API_BASE=http://192.168.x.x:8180

# iPhone (needs full Xcode from App Store)
flutter run --dart-define=API_BASE=http://192.168.x.x:8180
```

## Screens

| Tab | Purpose |
|-----|---------|
| **Trader** | Dominant hero + top ranked (1s tier1 poll) |
| **Scanner** | Top 5–8 dominance-ranked rows |
| **Positions** | Paper positions + exit advisories |
| **P&L** | ΣR + live $ marks |
| **Monitor** | Paper monitor + Telegram test |

## Controls

- **SCAN ON/OFF** → `PUT /api/live-trader/runtime`
- **TELEGRAM ON/OFF** → runtime + backend cooldowns
- **AUTO EXEC** → `OFF` / `PAPER_RESEARCH` only (1-share internal probes)

## Polling tiers

| Tier | Data | Interval |
|------|------|----------|
| 1 | tier1 + quotes (dominant) | 1s |
| 2 | snapshot (positions, P&L) | 8s |
| 3 | quotes (visible symbols) | 1s |
| 4 | paper monitor | 8s |

## Future

- `LIVE_ASSISTED` / `LIVE_AUTO` placeholders in runtime model
- WebSocket quote stream (backend SSE ready at `/api/execution/feed/stream`)
- Flutter web target

## Docs

See `docs/phases/PHASE_185_FLUTTER.md`.
