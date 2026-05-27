# Install Xcode on macOS 14.6 (Sonoma)

The **Mac App Store** only offers the latest Xcode (26.x), which requires **macOS 26.2+**.  
Your Mac is **macOS 14.6 Sonoma** — use **Xcode 15.4** instead (last version that supports Sonoma).

## Download Xcode 15.4 (Apple Developer — free)

1. Sign in with your Apple ID: [https://developer.apple.com/download/all/](https://developer.apple.com/download/all/)
2. Search: **Xcode 15.4**
3. Download: **Xcode_15.4.xip** (~7 GB)
4. Wait for the download to finish.

Alternative index (same files): [https://xcodereleases.com](https://xcodereleases.com) → find **15.4** for macOS 14.

## Install

1. Double-click **Xcode_15.4.xip** in Finder (extracts `Xcode.app` — can take 10–20 minutes).
2. Drag **Xcode.app** to **Applications**.
   - Optional: rename to `Xcode_15.4.app` if you want to keep multiple versions.
3. Open **Xcode** once → accept license → let it install extra components.
4. In Terminal:

```bash
cd /Users/pk/IdeaProjects/pktradingIBKR
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
./finish-ios-setup.sh
```

If you renamed the app:

```bash
sudo xcode-select --switch /Applications/Xcode_15.4.app/Contents/Developer
```

## Verify

```bash
xcodebuild -version
# Xcode 15.4 ...
flutter doctor
```

## Run on iPhone

```bash
./start-evolution.sh          # Mac — backend 8180
./start-mobile-iphone.sh      # iPhone — same Wi‑Fi
```

## Flutter note

Flutter **3.44** generally works with **Xcode 15.4** for device builds. If `flutter doctor` warns about Xcode version, it is usually still fine for `flutter run` on a physical device.

## If you can upgrade macOS later

If your Mac supports **macOS Sequoia 15** or newer, you can install newer Xcode from the App Store and use the latest iOS SDKs. Until then, **15.4 + Sonoma** is the correct pairing.

| macOS        | Xcode from App Store | What to use instead      |
|-------------|----------------------|---------------------------|
| 14.6 Sonoma | ❌ (needs 26.2+)      | **Xcode 15.4** (.xip)     |
| 15+ Sequoia | Newer Xcode          | App Store or Developer    |
