#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
INSTALL_DIR="/Applications"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

usage() {
  echo "Usage: $0 [--install-dir PATH]"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-dir)
      INSTALL_DIR="${2:-}"
      shift
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

TARGET_APP="$INSTALL_DIR/Timeline Studio Local.app"
"$SCRIPT_DIR/dock.sh" remove "$TARGET_APP"

PROCESS_PATH="$TARGET_APP/Contents/MacOS/Timeline Studio Local"
ps -ax -o pid=,command= | while read -r PROCESS_ID PROCESS_COMMAND; do
  if [ "$PROCESS_COMMAND" = "$PROCESS_PATH" ] || [[ "$PROCESS_COMMAND" == "$PROCESS_PATH "* ]]; then
    kill "$PROCESS_ID" >/dev/null 2>&1 || true
  fi
done
if [ -e "$TARGET_APP" ]; then
  if [ -x "$LSREGISTER" ]; then
    "$LSREGISTER" -u "$TARGET_APP" >/dev/null 2>&1 || true
  fi
  TRASH_TARGET="${HOME}/.Trash/Timeline Studio Local-uninstalled-$(date +%Y%m%d-%H%M%S).app.retired"
  mv "$TARGET_APP" "$TRASH_TARGET"
  if [ -x "$LSREGISTER" ]; then
    "$LSREGISTER" -u "$TRASH_TARGET" >/dev/null 2>&1 || true
  fi
  echo "App moved to Trash: $TRASH_TARGET"
else
  echo "App was not installed: $TARGET_APP"
fi

echo "Repository files and Safari site data were left unchanged."
