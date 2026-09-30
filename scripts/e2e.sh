#!/usr/bin/env bash
#
# Run the Maestro E2E suite against a local build.
#
# E2E here has more prerequisites than anything else in this repo, and each one
# fails in a different and unhelpful way if you just run `maestro test`. This
# script checks them first and says exactly what is missing, because "no devices
# found" three minutes into a run is not a useful error message.
#
# See docs/E2E_TESTING.md. Issue #20.
set -euo pipefail

cd "$(dirname "$0")/.."

APP_ENV="${APP_ENV:-development}"
BUNDLE_ID="com.mobiledope.app.${APP_ENV}"
[ "$APP_ENV" = "production" ] && BUNDLE_ID="com.mobiledope.app"

fail() {
  echo ""
  echo "✖ $1"
  shift
  for line in "$@"; do echo "  $line"; done
  echo ""
  echo "  Full setup: docs/E2E_TESTING.md"
  exit 1
}

# 1. Maestro itself.
command -v maestro >/dev/null 2>&1 || fail \
  "maestro is not installed." \
  "Install it:  curl -Ls https://get.maestro.mobile.dev | bash" \
  "Or:          brew install maestro"

# 2. A native project. This is a managed Expo workflow -- there is no committed
#    ios/ or android/ directory, and prebuild output is gitignored on purpose.
if [ ! -d ios ] && [ ! -d android ]; then
  fail "No native project found." \
    "This is a managed Expo workflow: ios/ and android/ are generated, not committed." \
    "Generate one:  npx expo prebuild --platform ios" \
    "Then build:    npx expo run:ios"
fi

# 3. A running device or simulator.
if command -v xcrun >/dev/null 2>&1 && xcrun simctl help >/dev/null 2>&1; then
  if ! xcrun simctl list devices booted 2>/dev/null | grep -q 'iPhone'; then
    fail "No booted iOS simulator." \
      "Boot one:  xcrun simctl boot 'iPhone 17'" \
      "Or run:    npx expo run:ios   (boots and installs in one step)"
  fi
elif command -v adb >/dev/null 2>&1; then
  adb devices | grep -q 'device$' || fail "No connected Android device or running emulator."
else
  fail "No iOS or Android tooling found." \
    "iOS needs full Xcode, not just Command Line Tools:" \
    "  sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer" \
    "Android needs adb on PATH."
fi

echo "Running Maestro flows against ${BUNDLE_ID}"
echo ""

# `--format junit` so a failure is machine-readable if this is ever wired into
# something. Flows tagged `destructive` are excluded by .maestro/config.yaml;
# pass --include-tags destructive to run them.
exec maestro test .maestro \
  --format junit \
  --output "${MAESTRO_REPORT:-.maestro/report.xml}" \
  "$@"
