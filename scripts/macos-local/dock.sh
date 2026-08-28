#!/bin/bash

set -euo pipefail

ACTION="${1:-}"
APP_PATH="${2:-/Applications/Timeline Studio Local.app}"
APP_LABEL="Timeline Studio Local"
APP_BUNDLE_ID="com.cannontang.timelinestudio.local"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

if [ "$ACTION" != "add" ] && [ "$ACTION" != "remove" ]; then
  echo "Usage: $0 <add|remove> [app-path]" >&2
  exit 2
fi

APP_PATH="$(cd "$(dirname "$APP_PATH")" 2>/dev/null && pwd -P)/$(basename "$APP_PATH")"
FILE_URL="$(node -e 'const { pathToFileURL } = require("node:url"); console.log(pathToFileURL(process.argv[1] + "/").href)' "$APP_PATH")"

if [ "$ACTION" = "add" ]; then
  if [ ! -d "$APP_PATH" ]; then
    echo "App is missing: $APP_PATH" >&2
    exit 1
  fi
  INSTALLED_BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_PATH/Contents/Info.plist" 2>/dev/null || true)"
  if [ "$INSTALLED_BUNDLE_ID" != "$APP_BUNDLE_ID" ]; then
    echo "Unexpected App bundle identifier: ${INSTALLED_BUNDLE_ID:-<missing>}" >&2
    exit 1
  fi

  # Replacing an App bundle changes its file identity. Dock can keep the old
  # bookmark and show a question-mark tile even when the new bundle uses the
  # same path, so always remove stale entries before asking Dock itself to pin
  # the running App. Do not synthesize a persistent-apps dictionary: it lacks
  # Dock's native bookmark metadata and can render as a question mark.
  "$0" remove "$APP_PATH" >/dev/null
  if [ -x "$LSREGISTER" ]; then
    "$LSREGISTER" -f "$APP_PATH"
  fi

  TARGET_EXECUTABLE_NAME="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_PATH/Contents/Info.plist")"
  TARGET_EXECUTABLE="$APP_PATH/Contents/MacOS/$TARGET_EXECUTABLE_NAME"
  APP_IS_RUNNING=0
  if ps -ax -o command= | awk -v expected="$TARGET_EXECUTABLE" '$0 == expected { found = 1 } END { exit !found }'; then
    APP_IS_RUNNING=1
  fi
  if [ "$APP_IS_RUNNING" -eq 0 ]; then
    /usr/bin/open "$APP_PATH"
  fi

  if ! PIN_RESULT="$(/usr/bin/osascript - "$APP_LABEL" <<'APPLESCRIPT'
on run arguments
  set appLabel to item 1 of arguments
  tell application "System Events"
    tell process "Dock"
      set targetItem to missing value
      repeat with waitIndex from 1 to 80
        try
          set matchingItems to every UI element of list 1 whose name is appLabel
          if (count of matchingItems) > 0 then
            set targetItem to item 1 of matchingItems
            exit repeat
          end if
        end try
        delay 0.1
      end repeat
      if targetItem is missing value then error "Dock did not expose " & appLabel

      -- A newly launched Dock tile can be named before its contextual menu is
      -- attached. Re-resolve the tile until the menu survives the launch
      -- animation instead of keeping a stale accessibility reference.
      delay 0.8
      set appMenu to missing value
      repeat with menuAttempt from 1 to 30
        try
          set targetItem to first UI element of list 1 whose name is appLabel
          perform action "AXShowMenu" of targetItem
          delay 0.2
          if exists menu 1 of targetItem then
            set appMenu to menu 1 of targetItem
            exit repeat
          end if
        end try
        delay 0.1
      end repeat
      if appMenu is missing value then error "Dock menu was not ready for " & appLabel

      set optionsItem to missing value
      repeat with optionName in {"选项", "Options"}
        try
          set optionsItem to menu item (contents of optionName) of appMenu
        end try
        if optionsItem is not missing value then exit repeat
      end repeat
      if optionsItem is missing value then
        key code 53
        error "Dock Options menu was not found"
      end if

      perform action "AXPress" of optionsItem
      set optionsMenu to missing value
      repeat with optionsAttempt from 1 to 20
        delay 0.1
        try
          if exists menu 1 of optionsItem then
            set optionsMenu to menu 1 of optionsItem
            exit repeat
          end if
        end try
      end repeat
      if optionsMenu is missing value then
        key code 53
        error "Dock Options submenu was not ready"
      end if
      repeat with removeName in {"从程序坞中移除", "Remove from Dock"}
        try
          if exists menu item (contents of removeName) of optionsMenu then
            key code 53
            return "already-kept"
          end if
        end try
      end repeat

      set keepItem to missing value
      repeat with keepName in {"在程序坞中保留", "Keep in Dock"}
        try
          set keepItem to menu item (contents of keepName) of optionsMenu
        end try
        if keepItem is not missing value then exit repeat
      end repeat
      if keepItem is missing value then
        key code 53
        error "Dock Keep in Dock command was not found"
      end if

      perform action "AXPress" of keepItem
      return "kept"
    end tell
  end tell
end run
APPLESCRIPT
  )"; then
    echo "Could not pin the App through Dock's native menu." >&2
    echo "Allow Accessibility control for this terminal, then rerun:" >&2
    echo "  $0 add \"$APP_PATH\"" >&2
    echo "No incomplete Dock item was written." >&2
    exit 1
  fi

  sleep 0.5
  killall Dock >/dev/null 2>&1 || true
  for _ in $(seq 1 50); do
    if /usr/bin/osascript -e 'tell application "System Events" to tell process "Dock" to get name of list 1' >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done

  if /usr/bin/swift - "$APP_BUNDLE_ID" "$FILE_URL" <<'SWIFT'
import Foundation

let expectedBundleID = CommandLine.arguments[1]
let expectedURL = CommandLine.arguments[2]
guard let dockDefaults = UserDefaults(suiteName: "com.apple.dock") else {
  exit(1)
}
let apps = dockDefaults.array(forKey: "persistent-apps") as? [[String: Any]] ?? []
let matches = apps.compactMap { entry -> [String: Any]? in
  guard let tileData = entry["tile-data"] as? [String: Any],
        tileData["bundle-identifier"] as? String == expectedBundleID else {
    return nil
  }
  return tileData
}
guard matches.count == 1,
      let fileData = matches[0]["file-data"] as? [String: Any],
      fileData["_CFURLString"] as? String == expectedURL,
      let bookmark = matches[0]["book"] as? Data,
      !bookmark.isEmpty else {
  exit(1)
}
SWIFT
  then
    echo "Added to Dock with native bookmark ($PIN_RESULT): $APP_PATH"
    exit 0
  fi

  "$0" remove "$APP_PATH" >/dev/null
  echo "Dock did not persist a complete bookmark; the incomplete item was removed." >&2
  echo "Right-click the running App in Dock and choose Options > Keep in Dock." >&2
  exit 1
fi

if ! REMOVED="$(/usr/bin/swift - "$APP_BUNDLE_ID" "$FILE_URL" "$APP_LABEL" <<'SWIFT'
import Foundation

let expectedBundleID = CommandLine.arguments[1]
let expectedURL = CommandLine.arguments[2]
let expectedLabel = CommandLine.arguments[3]
guard let dockDefaults = UserDefaults(suiteName: "com.apple.dock") else {
  print(0)
  exit(0)
}

func isTimelineEntry(_ entry: [String: Any]) -> Bool {
  guard let tileData = entry["tile-data"] as? [String: Any] else {
    return false
  }
  let fileData = tileData["file-data"] as? [String: Any]
  let url = fileData?["_CFURLString"] as? String
  let label = tileData["file-label"] as? String
  let bundleID = tileData["bundle-identifier"] as? String
  return url == expectedURL || label == expectedLabel || bundleID == expectedBundleID
}

var removedCount = 0
for key in ["persistent-apps", "recent-apps"] {
  let entries = dockDefaults.array(forKey: key) as? [[String: Any]] ?? []
  let retained = entries.filter { !isTimelineEntry($0) }
  removedCount += entries.count - retained.count
  if retained.count != entries.count {
    dockDefaults.set(retained, forKey: key)
  }
}
if removedCount > 0 {
  _ = dockDefaults.synchronize()
}
print(removedCount)
SWIFT
)"; then
  echo "Dock preferences are unavailable; nothing was removed." >&2
  exit 1
fi

if [ "$REMOVED" -gt 0 ]; then
  killall Dock >/dev/null 2>&1 || true
  echo "Removed from Dock: $APP_LABEL"
else
  echo "Dock item was not present: $APP_LABEL"
fi
