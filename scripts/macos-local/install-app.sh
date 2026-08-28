#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"
ARTIFACT_ROOT="${TIMELINE_LOCAL_BUILD_DIR:-$REPOSITORY_ROOT/.artifacts/macos-local}"
INSTALL_DIR="/Applications"
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
if [ ! -w "$INSTALL_DIR" ]; then
  echo "Install directory is not writable: $INSTALL_DIR" >&2
  exit 1
fi

if [ "$SKIP_BUILD" -eq 0 ]; then
  "$SCRIPT_DIR/build-app.sh"
fi

SOURCE_APP="$ARTIFACT_ROOT/Timeline Studio Local.app"
TARGET_APP="$INSTALL_DIR/Timeline Studio Local.app"
if [ ! -d "$SOURCE_APP" ]; then
  echo "Built App is missing: $SOURCE_APP" >&2
  exit 1
fi

if [ -e "$TARGET_APP" ]; then
  TRASH_BACKUP="${HOME}/.Trash/Timeline Studio Local-$(date +%Y%m%d-%H%M%S).app"
  mv "$TARGET_APP" "$TRASH_BACKUP"
  echo "Previous App moved to Trash: $TRASH_BACKUP"
fi

/usr/bin/ditto "$SOURCE_APP" "$TARGET_APP"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$TARGET_APP"

if [ "$ADD_TO_DOCK" -eq 1 ]; then
  "$SCRIPT_DIR/dock.sh" add "$TARGET_APP"
fi
if [ "$LAUNCH_AFTER_INSTALL" -eq 1 ]; then
  /usr/bin/open "$TARGET_APP"
fi

echo "Installed: $TARGET_APP"
