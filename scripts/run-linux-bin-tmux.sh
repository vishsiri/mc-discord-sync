#!/usr/bin/env bash
set -euo pipefail

# Recommended: run Linux-native binary via tmux.
# Usage:
#   chmod +x scripts/run-linux-bin-tmux.sh
#   BIN_PATH=build/mc-discord-sync-linux SESSION_NAME=mc-sync ./scripts/run-linux-bin-tmux.sh

SESSION_NAME="${SESSION_NAME:-mc-sync}"
WORKDIR="${WORKDIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BIN_PATH="${BIN_PATH:-$WORKDIR/build/mc-discord-sync-linux}"
APP_ENV_FILE="${APP_ENV_FILE:-$WORKDIR/.env}"

if ! command -v tmux >/dev/null 2>&1; then
  echo "[ERROR] tmux is not installed" >&2
  exit 1
fi

if [[ ! -x "$BIN_PATH" ]]; then
  echo "[ERROR] Linux binary not executable or missing: $BIN_PATH" >&2
  echo "Tip: chmod +x $BIN_PATH" >&2
  exit 1
fi

if [[ -f "$APP_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$APP_ENV_FILE"
  set +a
fi

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "[ERROR] tmux session already exists: $SESSION_NAME" >&2
  echo "Attach: tmux attach -t $SESSION_NAME" >&2
  exit 1
fi

CMD="cd '$WORKDIR' && '$BIN_PATH'"
tmux new-session -d -s "$SESSION_NAME" "$CMD"

echo "[OK] Started in tmux session: $SESSION_NAME"
echo "Attach: tmux attach -t $SESSION_NAME"
echo "Logs:   tmux capture-pane -pt $SESSION_NAME | tail -n 100"
