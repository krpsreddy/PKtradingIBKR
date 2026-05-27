#!/usr/bin/env bash
# One-time + verify mobile dev setup (Android now, iPhone after Xcode).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
MOBILE="$ROOT/pk-live-trader-mobile"
ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home}"
ZSH_SNIPPET="# PK Mobile Trader — add to ~/.zshrc
export ANDROID_HOME=\"$ANDROID_HOME\"
export JAVA_HOME=\"$JAVA_HOME\"
export PATH=\"\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/emulator:\$ANDROID_HOME/platform-tools:\$JAVA_HOME/bin:\$PATH\"
"

echo "=== PK Mobile Dev Setup ==="

if ! command -v flutter >/dev/null 2>&1; then
  echo "Installing Flutter..."
  brew install --cask flutter
fi

echo ""
echo "Flutter:"
flutter --version | head -1

echo ""
echo "Configuring Flutter Android SDK + JDK..."
flutter config --android-sdk "$ANDROID_HOME" --jdk-dir "$JAVA_HOME"

export ANDROID_HOME JAVA_HOME
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"

if ! sdkmanager --list_installed 2>/dev/null | grep -q "system-images;android-35"; then
  echo "Installing Android 35 system image..."
  yes | sdkmanager "platform-tools" "platforms;android-35" "platforms;android-36" \
    "build-tools;35.0.0" "build-tools;28.0.3" "system-images;android-35;google_apis;arm64-v8a" "emulator" || true
fi

if ! flutter emulators 2>/dev/null | grep -q pk_trader; then
  echo "Creating Android emulator pk_trader..."
  echo no | avdmanager create avd -n pk_trader -k "system-images;android-35;google_apis;arm64-v8a" -d pixel_7 || true
fi

yes | flutter doctor --android-licenses >/dev/null 2>&1 || true

echo ""
echo "Writing android/local.properties..."
cat > "$MOBILE/android/local.properties" <<EOF
sdk.dir=$ANDROID_HOME
flutter.sdk=$(dirname "$(dirname "$(which flutter)")")/share/flutter
EOF
# fix flutter.sdk path
FLUTTER_ROOT="$(dirname "$(dirname "$(command -v flutter)")")"
if [[ -d /opt/homebrew/share/flutter ]]; then
  FLUTTER_ROOT="/opt/homebrew/share/flutter"
fi
cat > "$MOBILE/android/local.properties" <<EOF
sdk.dir=$ANDROID_HOME
flutter.sdk=$FLUTTER_ROOT
EOF

cd "$MOBILE"
flutter pub get
flutter analyze

echo ""
flutter doctor

echo ""
echo "=== Shell environment (recommended) ==="
echo "$ZSH_SNIPPET"
SNIPPET_FILE="$ROOT/pk-live-trader-mobile/scripts/zshrc-snippet.sh"
mkdir -p "$(dirname "$SNIPPET_FILE")"
echo "$ZSH_SNIPPET" > "$SNIPPET_FILE"
echo "Saved: $SNIPPET_FILE"
echo "Run: cat $SNIPPET_FILE >> ~/.zshrc && source ~/.zshrc"

if [[ ! -d /Applications/Xcode.app ]]; then
  echo ""
  echo "=== iPhone (later) ==="
  echo "Install Xcode from the App Store, then run:"
  echo "  ./finish-ios-setup.sh"
else
  echo ""
  echo "Xcode found — run ./finish-ios-setup.sh to complete iOS."
fi

echo ""
echo "=== Ready ==="
echo "Android emulator:  ./start-mobile-android.sh"
echo "Android + backend: ./start-evolution.sh  (terminal 1)"
echo "                   ./start-mobile-android.sh  (terminal 2)"
echo "iPhone (after Xcode): ./start-mobile-iphone.sh"
