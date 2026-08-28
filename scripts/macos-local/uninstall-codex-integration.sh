#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"
CODEX_ROOT="${CODEX_HOME:-${HOME}/.codex}"
SKILL_SOURCE="$REPOSITORY_ROOT/skills/edit-timeline-studio"
SKILL_TARGET="$CODEX_ROOT/skills/edit-timeline-studio"
MCP_NAME="timeline_studio_local"

if command -v codex >/dev/null 2>&1 && codex mcp get "$MCP_NAME" --json >/dev/null 2>&1; then
  codex mcp remove "$MCP_NAME"
  echo "Removed Codex MCP server: $MCP_NAME"
else
  echo "Codex MCP server was not configured: $MCP_NAME"
fi

if [ -L "$SKILL_TARGET" ]; then
  if [ "$(readlink "$SKILL_TARGET")" = "$SKILL_SOURCE" ]; then
    rm "$SKILL_TARGET"
    echo "Removed Codex Skill link: $SKILL_TARGET"
  else
    echo "Skill link points elsewhere and was left unchanged: $SKILL_TARGET" >&2
  fi
elif [ -e "$SKILL_TARGET" ]; then
  echo "Skill target is not a link created by this checkout and was left unchanged: $SKILL_TARGET" >&2
else
  echo "Codex Skill link was not installed: $SKILL_TARGET"
fi

echo "Repository files and timestamped Skill backups were left unchanged."
