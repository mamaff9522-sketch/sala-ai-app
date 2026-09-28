#!/bin/bash
set -e

TOOLS_DIR="/app/applet/.tools"
JDK_DIR="$TOOLS_DIR/jdk"
SDK_DIR="$TOOLS_DIR/android-sdk"
CMDLINE_DIR="$SDK_DIR/cmdline-tools/latest"

mkdir -p "$TOOLS_DIR"

# 1. Setup JDK 17 if not present
if [ ! -f "$JDK_DIR/bin/java" ]; then
  echo "==> Downloading and setting up OpenJDK 17 in $JDK_DIR..."
  rm -rf "$JDK_DIR" && mkdir -p "$JDK_DIR"
  curl -fsSL https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_linux_hotspot_17.0.20.1_1.tar.gz | tar -xz -C "$JDK_DIR" --strip-components=1
fi

export JAVA_HOME="$JDK_DIR"
export PATH="$JDK_DIR/bin:$PATH"

echo "==> Java version:"
java -version

# 2. Setup Android SDK Command-line Tools if not present
if [ ! -f "$CMDLINE_DIR/bin/sdkmanager" ]; then
  echo "==> Downloading and setting up Android commandline tools in $SDK_DIR..."
  mkdir -p "$SDK_DIR/cmdline-tools"
  curl -fsSL -o /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  rm -rf "$SDK_DIR/cmdline-tools/cmdline-tools" "$CMDLINE_DIR"
  unzip -q /tmp/cmdline-tools.zip -d "$SDK_DIR/cmdline-tools"
  mv "$SDK_DIR/cmdline-tools/cmdline-tools" "$CMDLINE_DIR"
  rm -f /tmp/cmdline-tools.zip
fi

export ANDROID_HOME="$SDK_DIR"
export ANDROID_SDK_ROOT="$SDK_DIR"
export PATH="$CMDLINE_DIR/bin:$SDK_DIR/platform-tools:$PATH"

# 3. Accept licenses and install platform 36 and build-tools 36.0.0
echo "==> Ensuring Android SDK 36 and Build-Tools are installed..."
yes | "$CMDLINE_DIR/bin/sdkmanager" --licenses >/dev/null 2>&1 || true

if [ ! -d "$SDK_DIR/platforms/android-36" ]; then
  echo "==> Installing platforms;android-36 and build-tools;36.0.0..."
  "$CMDLINE_DIR/bin/sdkmanager" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
fi

# 4. Set local.properties
echo "sdk.dir=$SDK_DIR" > /app/applet/android/local.properties

# 5. Build web assets and sync Capacitor
echo "==> Syncing web build to Android assets..."
npm run build
npx cap sync android

# 6. Make gradlew executable
chmod +x /app/applet/android/gradlew

# 7. Assemble Debug APK
echo "==> Running assembleDebug..."
/app/applet/android/gradlew -p android assembleDebug --no-daemon

# 8. Locate generated APK
echo "==> Checking APK build output..."
APK_FILE=$(find /app/applet/android/app/build/outputs/apk -name "*.apk" 2>/dev/null | head -n 1)
if [ -n "$APK_FILE" ]; then
  echo "SUCCESS: APK created at $APK_FILE"
  mkdir -p /app/applet/dist-apk
  cp "$APK_FILE" /app/applet/dist-apk/SalaAI-debug.apk
  echo "SUCCESS: Copied to /app/applet/dist-apk/SalaAI-debug.apk"
  ls -lh /app/applet/dist-apk/SalaAI-debug.apk
else
  echo "ERROR: APK file not found!"
  exit 1
fi
