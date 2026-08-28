#!/bin/bash

set -euo pipefail

APP_PATH="${1:-/Applications/Timeline Studio Local.app}"
EXPECTED_BUNDLE_ID="com.cannontang.timelinestudio.local"
EXPECTED_MINIMUM_SYSTEM_VERSION="13.0"
TEST_PORT="${TIMELINE_LOCAL_TEST_PORT:-41873}"

if [ ! -d "$APP_PATH" ]; then
  echo "App is missing: $APP_PATH" >&2
  exit 1
fi

/usr/bin/codesign --verify --deep --strict --verbose=2 "$APP_PATH"
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_PATH/Contents/Info.plist")"
if [ "$BUNDLE_ID" != "$EXPECTED_BUNDLE_ID" ]; then
  echo "Unexpected bundle identifier: $BUNDLE_ID" >&2
  exit 1
fi

for required_path in \
  "$APP_PATH/Contents/MacOS/Timeline Studio Local" \
  "$APP_PATH/Contents/Resources/Site/index.html" \
  "$APP_PATH/Contents/Resources/serve-static.mjs" \
  "$APP_PATH/Contents/Resources/LauncherConfig.plist"; do
  if [ ! -e "$required_path" ]; then
    echo "Missing App resource: $required_path" >&2
    exit 1
  fi
done

EXECUTABLE_PATH="$APP_PATH/Contents/MacOS/Timeline Studio Local"
PLIST_MINIMUM_SYSTEM_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' "$APP_PATH/Contents/Info.plist")"
if [ "$PLIST_MINIMUM_SYSTEM_VERSION" != "$EXPECTED_MINIMUM_SYSTEM_VERSION" ]; then
  echo "Unexpected Info.plist minimum system version: $PLIST_MINIMUM_SYSTEM_VERSION" >&2
  exit 1
fi
if ! /usr/bin/xcrun vtool -show-build "$EXECUTABLE_PATH" \
  | grep -Eq "minos[[:space:]]+$EXPECTED_MINIMUM_SYSTEM_VERSION"; then
  echo "Native launcher deployment target does not match macOS $EXPECTED_MINIMUM_SYSTEM_VERSION:" >&2
  /usr/bin/xcrun vtool -show-build "$EXECUTABLE_PATH" >&2
  exit 1
fi

if [ -e "${HOME}/Library/LaunchAgents/$EXPECTED_BUNDLE_ID.plist" ] \
  || [ -e "/Library/LaunchAgents/$EXPECTED_BUNDLE_ID.plist" ] \
  || [ -e "/Library/LaunchDaemons/$EXPECTED_BUNDLE_ID.plist" ]; then
  echo "Unexpected auto-start configuration exists for $EXPECTED_BUNDLE_ID" >&2
  exit 1
fi

NODE_EXECUTABLE="$(/usr/libexec/PlistBuddy -c 'Print :nodeExecutable' "$APP_PATH/Contents/Resources/LauncherConfig.plist")"
SERVER_SCRIPT="$APP_PATH/Contents/Resources/serve-static.mjs"
SITE_ROOT="$APP_PATH/Contents/Resources/Site"
SMOKE_LOG="$(mktemp "${TMPDIR:-/tmp}/timeline-studio-local-smoke.XXXXXXXX.log")"
HEADERS_FILE="$(mktemp "${TMPDIR:-/tmp}/timeline-studio-local-headers.XXXXXXXX")"
BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/timeline-studio-local-body.XXXXXXXX")"
SERVER_PID=""
LAUNCHER_PID=""
LAUNCHER_LOG=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [ -n "$LAUNCHER_PID" ] && kill -0 "$LAUNCHER_PID" >/dev/null 2>&1; then
    kill "$LAUNCHER_PID" >/dev/null 2>&1 || true
    wait "$LAUNCHER_PID" 2>/dev/null || true
  fi
  rm -f "$SMOKE_LOG" "$HEADERS_FILE" "$BODY_FILE"
  if [ -n "$LAUNCHER_LOG" ]; then rm -f "$LAUNCHER_LOG"; fi
}
trap cleanup EXIT

"$NODE_EXECUTABLE" "$SERVER_SCRIPT" --root "$SITE_ROOT" --host 127.0.0.1 --port "$TEST_PORT" >"$SMOKE_LOG" 2>&1 &
SERVER_PID=$!

READY=0
for _ in $(seq 1 50); do
  if curl -sS --max-time 1 -D "$HEADERS_FILE" -o "$BODY_FILE" "http://127.0.0.1:$TEST_PORT/" 2>/dev/null; then
    READY=1
    break
  fi
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

if [ "$READY" -ne 1 ]; then
  echo "Static server smoke test failed:" >&2
  sed -n '1,120p' "$SMOKE_LOG" >&2
  exit 1
fi

grep -Eiq '^Cross-Origin-Opener-Policy: same-origin' "$HEADERS_FILE"
grep -Eiq '^Cross-Origin-Embedder-Policy: require-corp' "$HEADERS_FILE"
grep -Eiq '^Cross-Origin-Resource-Policy: same-origin' "$HEADERS_FILE"
grep -Eiq '^X-Timeline-Studio-Local: 1' "$HEADERS_FILE"
grep -q 'Timeline Studio' "$BODY_FILE"

INVALID_HOST_STATUS="$(curl -sS --max-time 2 -o /dev/null -w '%{http_code}' -H 'Host: example.invalid' "http://127.0.0.1:$TEST_PORT/")"
if [ "$INVALID_HOST_STATUS" != "403" ]; then
  echo "Invalid Host request returned $INVALID_HOST_STATUS instead of 403" >&2
  exit 1
fi
TRAVERSAL_STATUS="$(curl --path-as-is -sS --max-time 2 -o /dev/null -w '%{http_code}' -H 'Accept: application/octet-stream' "http://127.0.0.1:$TEST_PORT/..%2fLauncherConfig.plist")"
if [ "$TRAVERSAL_STATUS" != "403" ]; then
  echo "Path traversal request returned $TRAVERSAL_STATUS instead of 403" >&2
  exit 1
fi

RANGE_STATUS="$(curl -sS --max-time 2 -o /dev/null -w '%{http_code}' -H 'Range: bytes=0-15' "http://127.0.0.1:$TEST_PORT/index.html")"
if [ "$RANGE_STATUS" != "206" ]; then
  echo "Range request returned $RANGE_STATUS instead of 206" >&2
  exit 1
fi

kill "$SERVER_PID"
wait "$SERVER_PID" 2>/dev/null || true
SERVER_PID=""
sleep 0.2
if curl -sS --max-time 1 "http://127.0.0.1:$TEST_PORT/" >/dev/null 2>&1; then
  echo "Static server remained reachable after termination" >&2
  exit 1
fi

LAUNCHER_LOG="$(mktemp "${TMPDIR:-/tmp}/timeline-studio-local-launcher.XXXXXXXX.log")"
"$APP_PATH/Contents/MacOS/Timeline Studio Local" --smoke-test >"$LAUNCHER_LOG" 2>&1 &
LAUNCHER_PID=$!
LAUNCHER_FINISHED=0
for _ in $(seq 1 200); do
  if ! kill -0 "$LAUNCHER_PID" >/dev/null 2>&1; then
    LAUNCHER_FINISHED=1
    break
  fi
  sleep 0.1
done
if [ "$LAUNCHER_FINISHED" -ne 1 ]; then
  kill "$LAUNCHER_PID" >/dev/null 2>&1 || true
  echo "Native launcher smoke test timed out" >&2
  sed -n '1,120p' "$LAUNCHER_LOG" >&2
  exit 1
fi
if ! wait "$LAUNCHER_PID"; then
  echo "Native launcher smoke test failed" >&2
  sed -n '1,120p' "$LAUNCHER_LOG" >&2
  exit 1
fi
LAUNCHER_PID=""
grep -q 'launcher smoke test passed' "$LAUNCHER_LOG"
rm -f "$LAUNCHER_LOG"
LAUNCHER_LOG=""
if curl -sS --max-time 1 "http://127.0.0.1:4173/" >/dev/null 2>&1; then
  echo "Native launcher left port 4173 reachable after exit" >&2
  exit 1
fi

if /usr/bin/xattr -p com.apple.quarantine "$APP_PATH" >/dev/null 2>&1; then
  echo "Warning: App has a quarantine attribute; use System Settings > Privacy & Security > Open Anyway."
fi

echo "Verified local static App: $APP_PATH"
echo "Verified no LaunchAgent or LaunchDaemon for: $EXPECTED_BUNDLE_ID"
echo "Verified static server starts on demand and stops cleanly."
echo "Verified native launcher starts and owns the static-server lifecycle."
