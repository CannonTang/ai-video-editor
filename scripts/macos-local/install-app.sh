#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"
ARTIFACT_ROOT="${TIMELINE_LOCAL_BUILD_DIR:-$REPOSITORY_ROOT/.artifacts/macos-local}"
INSTALL_DIR="/Applications"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
SKIP_BUILD=0
ADD_TO_DOCK=1
LAUNCH_AFTER_INSTALL=1

usage() {
  echo "Usage: $0 [--skip-build] [--install-dir PATH] [--no-dock] [--no-launch]"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-build)
      SKIP_BUILD=1
      ;;
    --install-dir)
      INSTALL_DIR="${2:-}"
      shift
      ;;
    --no-dock)
      ADD_TO_DOCK=0
      ;;
    --no-launch)
      LAUNCH_AFTER_INSTALL=0
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if [ -z "$INSTALL_DIR" ] || [ ! -d "$INSTALL_DIR" ]; then
  echo "Install directory does not exist: $INSTALL_DIR" >&2
  exit 1
fi
if [ "$ADD_TO_DOCK" -eq 1 ] && [ "$LAUNCH_AFTER_INSTALL" -eq 0 ]; then
  echo "--no-launch requires --no-dock because native Dock pinning needs a running App." >&2
  exit 2
fi
if [ ! -w "$INSTALL_DIR" ]; then
  echo "Install directory is not writable: $INSTALL_DIR" >&2
  exit 1
fi
if [ ! -x "$LSREGISTER" ]; then
  echo "LaunchServices registration tool is missing: $LSREGISTER" >&2
  exit 1
fi

if [ "$SKIP_BUILD" -eq 0 ]; then
  "$SCRIPT_DIR/build-app.sh"
fi

SOURCE_APP="$ARTIFACT_ROOT/Timeline Studio Local.app"
TARGET_APP="$INSTALL_DIR/Timeline Studio Local.app"
TARGET_EXECUTABLE="$TARGET_APP/Contents/MacOS/Timeline Studio Local"
if [ ! -d "$SOURCE_APP" ]; then
  echo "Built App is missing: $SOURCE_APP" >&2
  exit 1
fi

running_launcher_pids() {
  ps -ax -o pid=,command= | awk -v expected="$TARGET_EXECUTABLE" '
    {
      process_id = $1
      sub(/^[[:space:]]*[0-9]+[[:space:]]+/, "", $0)
      if ($0 == expected) print process_id
    }
  '
}

if [ -n "$(running_launcher_pids)" ]; then
  /usr/bin/osascript -e 'tell application id "com.cannontang.timelinestudio.local" to quit' >/dev/null 2>&1 || true
  for _ in $(seq 1 100); do
    if [ -z "$(running_launcher_pids)" ]; then
      break
    fi
    sleep 0.1
  done
  if [ -n "$(running_launcher_pids)" ]; then
    echo "Timeline Studio Local is still running; quit it before reinstalling." >&2
    exit 1
  fi
fi

if [ -e "$TARGET_APP" ]; then
  "$SCRIPT_DIR/dock.sh" remove "$TARGET_APP" >/dev/null
  "$LSREGISTER" -u "$TARGET_APP" >/dev/null 2>&1 || true
  # Keep the replacement recoverable without leaving another discoverable
  # .app bundle for LaunchServices and Dock to resolve by the same bundle ID.
  TRASH_BACKUP="${HOME}/.Trash/Timeline Studio Local-$(date +%Y%m%d-%H%M%S).app.retired"
  mv "$TARGET_APP" "$TRASH_BACKUP"
  "$LSREGISTER" -u "$TRASH_BACKUP" >/dev/null 2>&1 || true
  echo "Previous App moved to Trash: $TRASH_BACKUP"
fi

/usr/bin/ditto "$SOURCE_APP" "$TARGET_APP"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$TARGET_APP"
"$LSREGISTER" -u "$SOURCE_APP" >/dev/null 2>&1 || true
"$LSREGISTER" -f "$TARGET_APP"

if [ "$ADD_TO_DOCK" -eq 1 ]; then
  "$SCRIPT_DIR/dock.sh" add "$TARGET_APP"
elif [ "$LAUNCH_AFTER_INSTALL" -eq 1 ]; then
  /usr/bin/open "$TARGET_APP"
fi

echo "Installed: $TARGET_APP"
