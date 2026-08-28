#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"
CODEX_ROOT="${CODEX_HOME:-${HOME}/.codex}"
SKILLS_DIR="$CODEX_ROOT/skills"
SKILL_SOURCE="$REPOSITORY_ROOT/skills/edit-timeline-studio"
SKILL_TARGET="$SKILLS_DIR/edit-timeline-studio"
MCP_NAME="timeline_studio_local"
FORCE=0
CHECK_ONLY=0

usage() {
  echo "Usage: $0 [--check] [--force]"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --force)
      FORCE=1
      ;;
    --check)
      CHECK_ONLY=1
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

for command_name in codex node npm; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command is missing: $command_name" >&2
    exit 1
  fi
done
if [ ! -f "$SKILL_SOURCE/SKILL.md" ]; then
  echo "Skill source is missing: $SKILL_SOURCE" >&2
  exit 1
fi
if [ ! -f "$REPOSITORY_ROOT/scripts/timeline-command.mjs" ] \
  || [ ! -d "$REPOSITORY_ROOT/node_modules/@modelcontextprotocol" ]; then
  echo "Repository dependencies are not installed. Run npm ci first." >&2
  exit 1
fi

SKILL_CONFLICT=0
if [ -L "$SKILL_TARGET" ] && [ "$(readlink "$SKILL_TARGET")" = "$SKILL_SOURCE" ]; then
  SKILL_CONFLICT=0
elif [ -e "$SKILL_TARGET" ] || [ -L "$SKILL_TARGET" ]; then
  SKILL_CONFLICT=1
fi
MCP_EXISTS=0
if codex mcp get "$MCP_NAME" --json >/dev/null 2>&1; then
  MCP_EXISTS=1
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo "Repository root: $REPOSITORY_ROOT"
  echo "Skill source: $SKILL_SOURCE"
  echo "Skill target: $SKILL_TARGET"
  if [ "$SKILL_CONFLICT" -eq 1 ]; then
    echo "Skill target status: occupied by another installation"
  elif [ -L "$SKILL_TARGET" ]; then
    echo "Skill target status: already linked to this checkout"
  else
    echo "Skill target status: available"
  fi
  if [ "$MCP_EXISTS" -eq 1 ]; then
    echo "MCP status: $MCP_NAME already exists"
  else
    echo "MCP status: $MCP_NAME is available"
  fi
  echo "Check complete; no Codex configuration was changed."
  exit 0
fi

if [ "$FORCE" -ne 1 ] && [ "$SKILL_CONFLICT" -eq 1 ]; then
  echo "Codex Skill target already exists: $SKILL_TARGET" >&2
  echo "Re-run with --force to move it to a timestamped backup." >&2
  exit 1
fi
if [ "$FORCE" -ne 1 ] && [ "$MCP_EXISTS" -eq 1 ]; then
  echo "Codex MCP server already exists: $MCP_NAME" >&2
  echo "Re-run with --force to replace it." >&2
  exit 1
fi

mkdir -p "$SKILLS_DIR"
if [ -L "$SKILL_TARGET" ] && [ "$(readlink "$SKILL_TARGET")" = "$SKILL_SOURCE" ]; then
  echo "Codex Skill link already points to this checkout."
elif [ -e "$SKILL_TARGET" ] || [ -L "$SKILL_TARGET" ]; then
  SKILL_BACKUP="$SKILLS_DIR/edit-timeline-studio.backup-$(date +%Y%m%d-%H%M%S)"
  mv "$SKILL_TARGET" "$SKILL_BACKUP"
  echo "Existing Skill moved to: $SKILL_BACKUP"
  ln -s "$SKILL_SOURCE" "$SKILL_TARGET"
else
  ln -s "$SKILL_SOURCE" "$SKILL_TARGET"
fi

if [ "$MCP_EXISTS" -eq 1 ]; then
  codex mcp remove "$MCP_NAME"
fi

NPM_EXECUTABLE="$(command -v npm)"
codex mcp add "$MCP_NAME" \
  --env "TIMELINE_STUDIO_ROOT=$REPOSITORY_ROOT" \
  -- "$NPM_EXECUTABLE" --prefix "$REPOSITORY_ROOT" run mcp --silent

codex mcp get "$MCP_NAME" --json
echo "Installed Codex Skill link: $SKILL_TARGET"
echo "Installed Codex MCP server: $MCP_NAME"
echo "Open a new Codex session to refresh the Skill and MCP tool inventory."
