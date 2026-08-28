#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"
ARTIFACT_ROOT="${TIMELINE_LOCAL_BUILD_DIR:-$REPOSITORY_ROOT/.artifacts/macos-local}"
APP_NAME="Timeline Studio Local.app"
APP_PATH="$ARTIFACT_ROOT/$APP_NAME"
ZIP_PATH="$ARTIFACT_ROOT/Timeline-Studio-Local-macOS.zip"
MACOS_DEPLOYMENT_TARGET="13.0"
SKIP_WEB_BUILD=0

usage() {
  echo "Usage: $0 [--skip-web-build]"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-web-build)
      SKIP_WEB_BUILD=1
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

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Timeline Studio Local.app can only be built on macOS." >&2
  exit 1
fi

for command_name in node npm xcrun codesign ditto iconutil sips; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command is missing: $command_name" >&2
    exit 1
  fi
done

NODE_EXECUTABLE="$(command -v node)"
BUILD_ARCH="$(uname -m)"
case "$BUILD_ARCH" in
  arm64|x86_64) ;;
  *)
    echo "Unsupported macOS architecture: $BUILD_ARCH" >&2
    exit 1
    ;;
esac

if [ "$SKIP_WEB_BUILD" -eq 0 ]; then
  if [ ! -x "$REPOSITORY_ROOT/node_modules/.bin/vite" ]; then
    (cd "$REPOSITORY_ROOT" && npm ci)
  fi
  (cd "$REPOSITORY_ROOT" && npm run build)
fi

if [ ! -f "$REPOSITORY_ROOT/dist/index.html" ]; then
  echo "dist/index.html is missing. Run npm run build or omit --skip-web-build." >&2
  exit 1
fi

mkdir -p "$ARTIFACT_ROOT"
BUILD_TEMP="$(mktemp -d "${TMPDIR:-/tmp}/timeline-studio-local-build.XXXXXXXX")"
VERIFY_TEMP="$(mktemp -d "${TMPDIR:-/tmp}/timeline-studio-local-verify.XXXXXXXX")"
cleanup() {
  rm -rf "$BUILD_TEMP" "$VERIFY_TEMP"
}
trap cleanup EXIT

STAGED_APP="$BUILD_TEMP/$APP_NAME"
CONTENTS="$STAGED_APP/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES_DIR="$CONTENTS/Resources"
ICONSET_DIR="$BUILD_TEMP/AppIcon.iconset"

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR" "$ICONSET_DIR"
/usr/bin/ditto "$SCRIPT_DIR/Info.plist" "$CONTENTS/Info.plist"

SOURCE_ICON="$REPOSITORY_ROOT/public/icons/timeline-studio-icon-512.png"
if [ ! -f "$SOURCE_ICON" ]; then
  echo "App icon is missing: $SOURCE_ICON" >&2
  exit 1
fi

/usr/bin/sips -z 16 16 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
/usr/bin/sips -z 32 32 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
/usr/bin/sips -z 32 32 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
/usr/bin/sips -z 64 64 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
/usr/bin/sips -z 128 128 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
/usr/bin/sips -z 256 256 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
/usr/bin/sips -z 256 256 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
/usr/bin/sips -z 512 512 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
/usr/bin/sips -z 512 512 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
/usr/bin/sips -z 1024 1024 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null
/usr/bin/iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES_DIR/AppIcon.icns"

/usr/bin/xcrun swiftc \
  -target "${BUILD_ARCH}-apple-macosx${MACOS_DEPLOYMENT_TARGET}" \
  -parse-as-library \
  -O \
  -framework AppKit \
  "$SCRIPT_DIR/TimelineStudioLocalLauncher.swift" \
  -o "$MACOS_DIR/Timeline Studio Local"

/usr/bin/ditto "$REPOSITORY_ROOT/dist" "$RESOURCES_DIR/Site"
/usr/bin/ditto "$SCRIPT_DIR/serve-static.mjs" "$RESOURCES_DIR/serve-static.mjs"

CONFIG_PLIST="$RESOURCES_DIR/LauncherConfig.plist"
/usr/libexec/PlistBuddy -c "Add :nodeExecutable string $NODE_EXECUTABLE" "$CONFIG_PLIST"
/usr/libexec/PlistBuddy -c "Add :port integer 4173" "$CONFIG_PLIST"
/usr/bin/plutil -lint "$CONTENTS/Info.plist" "$CONFIG_PLIST"

/usr/bin/codesign --force --deep --sign - "$STAGED_APP"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$STAGED_APP"

rm -rf "$APP_PATH"
rm -f "$ZIP_PATH"
/usr/bin/ditto "$STAGED_APP" "$APP_PATH"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"
/usr/bin/ditto -x -k "$ZIP_PATH" "$VERIFY_TEMP"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$VERIFY_TEMP/$APP_NAME"

echo "Built: $APP_PATH"
echo "Packaged: $ZIP_PATH"
