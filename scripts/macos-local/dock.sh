#!/bin/bash

set -euo pipefail

ACTION="${1:-}"
APP_PATH="${2:-/Applications/Timeline Studio Local.app}"
APP_LABEL="Timeline Studio Local"

if [ "$ACTION" != "add" ] && [ "$ACTION" != "remove" ]; then
  echo "Usage: $0 <add|remove> [app-path]" >&2
  exit 2
fi

APP_PATH="$(cd "$(dirname "$APP_PATH")" 2>/dev/null && pwd -P)/$(basename "$APP_PATH")"
FILE_URL="$(node -e 'const { pathToFileURL } = require("node:url"); console.log(pathToFileURL(process.argv[1] + "/").href)' "$APP_PATH")"

if [ "$ACTION" = "add" ]; then
  # Replacing an App bundle changes its file identity. Dock can keep the old
  # bookmark and show a question-mark tile even when the new bundle uses the
  # same path, so always remove stale label/path entries before adding it.
  "$0" remove "$APP_PATH" >/dev/null

  defaults write com.apple.dock persistent-apps -array-add \
    "{\"tile-data\"={\"file-data\"={\"_CFURLString\"=\"$FILE_URL\";\"_CFURLStringType\"=15;};\"file-label\"=\"$APP_LABEL\";};\"tile-type\"=\"file-tile\";}"
  killall Dock >/dev/null 2>&1 || true
  echo "Added to Dock: $APP_PATH"
  exit 0
fi

DOCK_EXPORT="$(mktemp "${TMPDIR:-/tmp}/timeline-studio-dock.XXXXXXXX.plist")"
cleanup() {
  rm -f "$DOCK_EXPORT"
}
trap cleanup EXIT

if ! defaults export com.apple.dock "$DOCK_EXPORT" >/dev/null 2>&1; then
  echo "Dock preferences are unavailable; nothing to remove."
  exit 0
fi

INDEX=0
REMOVED=0
while /usr/libexec/PlistBuddy -c "Print :persistent-apps:$INDEX" "$DOCK_EXPORT" >/dev/null 2>&1; do
  ENTRY_URL="$(/usr/libexec/PlistBuddy -c "Print :persistent-apps:$INDEX:tile-data:file-data:_CFURLString" "$DOCK_EXPORT" 2>/dev/null || true)"
  ENTRY_LABEL="$(/usr/libexec/PlistBuddy -c "Print :persistent-apps:$INDEX:tile-data:file-label" "$DOCK_EXPORT" 2>/dev/null || true)"
  if [ "$ENTRY_URL" = "$FILE_URL" ] || [ "$ENTRY_LABEL" = "$APP_LABEL" ]; then
    /usr/libexec/PlistBuddy -c "Delete :persistent-apps:$INDEX" "$DOCK_EXPORT"
    REMOVED=1
    continue
  fi
  INDEX=$((INDEX + 1))
done

if [ "$REMOVED" -eq 1 ]; then
  defaults import com.apple.dock "$DOCK_EXPORT" >/dev/null
  killall Dock >/dev/null 2>&1 || true
  echo "Removed from Dock: $APP_LABEL"
else
  echo "Dock item was not present: $APP_LABEL"
fi
