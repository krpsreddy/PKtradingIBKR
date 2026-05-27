# Remote mobile access via Tailscale

Use Tailscale so your phone reaches the evolution backend on your Mac (`:8180`) from anywhere — cellular, office Wi‑Fi, travel — without opening router ports.

## Architecture

```
Phone (Tailscale) ──encrypted mesh──► Mac (Tailscale) :8180 ──► IBKR Gateway :4002
```

Intelligence and IBKR stay on the Mac at home. The Flutter app is display + controls only.

## One-time setup

### Mac (home trading machine)

```bash
./setup-tailscale.sh
```

Or: `brew install --cask tailscale` → open **Tailscale** → sign in.

Keep Tailscale running (menu bar: **Connected**).

### Phone (required for `100.88.194.48` to work)

1. Install **Tailscale** (Play Store / App Store).
2. Sign in with the **same account** as the Mac (`krpsreddy@` / Purushotham Reddy).
3. Toggle Tailscale **ON** — status must show **Connected**.

Without Tailscale on the phone, `100.88.194.48` will **not** work (browser or app). At home on Wi‑Fi use **`http://192.168.2.25:8180`** instead (`./start-mobile-android-phone.sh`).

### Mac must be on

```bash
./start-evolution.sh    # backend :8180
# IB Gateway paper on 4002
```

## Run app with Tailscale URL

USB Android (auto-detects Tailscale IP):

```bash
./start-mobile-remote.sh
```

Manual:

```bash
API_BASE=$(./scripts/tailscale-api-base.sh)
cd pk-live-trader-mobile
flutter run --dart-define=API_BASE="$API_BASE"
```

Status bar should show your Mac Tailscale host (e.g. `100.88.194.48:8180`).

Configured in repo root `mobile.env` (from `mobile.env.example`).

## APK for away-from-home (no USB)

```bash
API_BASE=$(./scripts/tailscale-api-base.sh) ./build-mobile-apk.sh
adb install -r pk-live-trader-mobile/build/app/outputs/flutter-apk/app-release.apk
```

Rebuild if your Mac gets a new Tailscale IP (usually stable per machine).

## Verify from the phone

With Tailscale ON, open the phone browser (optional):

`http://100.x.y.z:8180/api/live-trader/tier1`

You should see JSON. If that works, the Flutter app will work.

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| App shows connection error | Tailscale OFF on phone or Mac |
| Wrong host in status bar | Re-run `./start-mobile-remote.sh` or rebuild APK |
| Browser works, app doesn’t | Old APK — reinstall with Tailscale `API_BASE` |
| Mac asleep | Wake Mac or disable sleep while trading |
| Mac firewall blocks | System Settings → Network → Firewall → allow Java/Tailscale |

## Security notes

- Prefer Tailscale over port-forwarding `8180` to the public internet.
- The evolution API has no mobile auth today — Tailscale membership is your access control.
- Do not share your Tailscale account.

## At home vs away

| Location | Typical `API_BASE` |
|----------|-------------------|
| Home Wi‑Fi (same LAN) | `http://192.168.x.x:8180` — `./start-mobile-android-phone.sh` |
| Away | `http://100.88.194.48:8180` — `./start-mobile-remote.sh` |

You can use the Tailscale URL at home too; it always works if both devices are on the mesh.
