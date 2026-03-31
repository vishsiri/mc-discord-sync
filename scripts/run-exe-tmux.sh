#!/usr/bin/env bash
set -euo pipefail

# Run Windows EXE on Linux server via Wine inside tmux.
# Usage:
#   chmod +x scripts/run-exe-tmux.sh
#   APP_ENV_FILE=.env SESSION_NAME=mc-sync ./scripts/run-exe-tmux.sh

SESSION_NAME="${SESSION_NAME:-mc-sync}"
WORKDIR="${WORKDIR:-$PWD}"
EXE_PATH="${EXE_PATH:-$WORKDIR/build/mc-discord-sync.exe}"
APP_ENV_FILE="${APP_ENV_FILE:-$WORKDIR/.env}"
WINE_BIN="${WINE_BIN:-}"
STARTUP_WAIT_SEC="${STARTUP_WAIT_SEC:-2}"
LOG_PATH="${LOG_PATH:-$WORKDIR/logs/${SESSION_NAME}.log}"

resolve_wine_bin() {
  if [[ -n "$WINE_BIN" ]] && command -v "$WINE_BIN" >/dev/null 2>&1; then
    echo "$WINE_BIN"
    return 0
  fi

  for candidate in wine64 wine wine64-stable; do
    if command -v "$candidate" >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done

  for candidate in /usr/bin/wine64 /usr/bin/wine /usr/lib/wine/wine64; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

load_env_file() {
  local env_file="$1"
  local line
  local key
  local value

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"

    # Skip comments and empty lines.
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue

    # Support optional "export KEY=VALUE" format.
    if [[ "$line" =~ ^[[:space:]]*export[[:space:]]+ ]]; then
      line="${line#export }"
    fi

    [[ "$line" == *"="* ]] || continue

    key="${line%%=*}"
    value="${line#*=}"

    # Trim key/value whitespace.
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    # Strip a single pair of wrapping quotes if present.
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < "$env_file"
}

if ! command -v tmux >/dev/null 2>&1; then
  echo "[ERROR] tmux is not installed" >&2
  exit 1
fi

if ! WINE_CMD="$(resolve_wine_bin)"; then
  echo "[ERROR] Wine binary not found in PATH" >&2
  echo "Install Wine first, e.g. apt install wine64 wine" >&2
  echo "Or set WINE_BIN explicitly, e.g. WINE_BIN=/usr/bin/wine" >&2
  exit 1
fi

if [[ ! -f "$EXE_PATH" ]]; then
  echo "[ERROR] EXE not found: $EXE_PATH" >&2
  exit 1
fi

if [[ -f "$APP_ENV_FILE" ]]; then
  load_env_file "$APP_ENV_FILE"
fi

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "[ERROR] tmux session already exists: $SESSION_NAME" >&2
  echo "Attach: tmux attach -t $SESSION_NAME" >&2
  exit 1
fi

mkdir -p "$(dirname "$LOG_PATH")"

CMD="cd '$WORKDIR' && '$WINE_CMD' '$EXE_PATH' >> '$LOG_PATH' 2>&1"
tmux new-session -d -s "$SESSION_NAME" "$CMD"

sleep "$STARTUP_WAIT_SEC"

if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "[ERROR] tmux session exited immediately: $SESSION_NAME" >&2
  if [[ -f "$LOG_PATH" ]]; then
    echo "----- last logs: $LOG_PATH -----" >&2
    tail -n 100 "$LOG_PATH" >&2 || true
    echo "--------------------------------" >&2
  fi
  exit 1
fi

echo "[OK] Started in tmux session: $SESSION_NAME"
echo "Attach: tmux attach -t $SESSION_NAME"
echo "Logs:   tmux capture-pane -pt $SESSION_NAME | tail -n 100"
echo "File:   $LOG_PATH"
