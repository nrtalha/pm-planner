#!/usr/bin/env bash
# Start SOW Architect locally: builds the web app when its sources changed, then serves the
# app and the API together on http://127.0.0.1:${PORT:-8000}. Press Ctrl+C to stop.
#
#   ./start.sh              start, and open the browser when ready
#   ./start.sh --no-open    start without opening a browser
#   ./start.sh --rebuild    rebuild the web app even if it looks up to date
#   PORT=8010 ./start.sh    use another port
#
# Works with the macOS system bash (3.2). Binds to 127.0.0.1 only: nothing is exposed to the network.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8000}"
OPEN_BROWSER=1
FORCE_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --no-open) OPEN_BROWSER=0 ;;
    --rebuild) FORCE_BUILD=1 ;;
    -h | --help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 2
      ;;
  esac
done

info() { printf '\033[1;36m›\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
fail() {
  printf '\033[1;31m✗\033[0m %s\n' "$*" >&2
  exit 1
}

cd "$ROOT"

# --- Checks ---------------------------------------------------------------------------------

case "$PORT" in
  '' | *[!0-9]*) fail "PORT must be a number (got '$PORT')." ;;
esac

PYTHON="$ROOT/.venv/bin/python"
[ -x "$PYTHON" ] || fail "No Python environment found. Set it up once with:
    python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt"

"$PYTHON" -c 'import fastapi, uvicorn, pandas, plotly, pptx, xlsxwriter' 2>/dev/null ||
  fail "Python packages are missing or out of date. Run:
    .venv/bin/pip install -r requirements.txt"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  fail "Port $PORT is already in use. Stop whatever is using it, or run: PORT=8010 ./start.sh"
fi

# Generating plans needs the Claude Code CLI signed in to your subscription.
# Not fatal: opening a saved plan.json and every export work without it.
if ! command -v claude >/dev/null 2>&1; then
  warn "Claude Code CLI not found. 'New plan' needs it; install it, then run: claude auth login"
elif ! env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL claude auth status 2>/dev/null | grep -q '"loggedIn": true'; then
  warn "Claude Code is not signed in. 'New plan' needs it; run: claude auth login"
fi

# --- Web app build --------------------------------------------------------------------------

WEB="$ROOT/web"
DIST_INDEX="$WEB/dist/index.html"

needs_build() {
  [ "$FORCE_BUILD" -eq 1 ] && return 0
  [ -f "$DIST_INDEX" ] || return 0
  # Rebuild when any source or config file is newer than the last build.
  [ -n "$(find "$WEB/src" "$WEB/public" "$WEB/index.html" "$WEB/package.json" "$WEB/pnpm-lock.yaml" \
    "$WEB/vite.config.ts" -newer "$DIST_INDEX" -print -quit 2>/dev/null)" ]
}

if needs_build; then
  command -v pnpm >/dev/null 2>&1 || fail "pnpm is needed to build the web app. Install it: npm install -g pnpm"
  if [ ! -d "$WEB/node_modules" ] || [ "$WEB/pnpm-lock.yaml" -nt "$WEB/node_modules/.modules.yaml" ]; then
    info "Installing web dependencies…"
    (cd "$WEB" && pnpm install --frozen-lockfile)
  fi
  info "Building the web app…"
  (cd "$WEB" && pnpm build)
else
  info "Web app is up to date."
fi

# --- Run ------------------------------------------------------------------------------------

URL="http://127.0.0.1:$PORT"

if [ "$OPEN_BROWSER" -eq 1 ] && command -v open >/dev/null 2>&1; then
  # Open the browser once the server answers (gives up after ~20 s).
  (
    for _ in $(seq 1 40); do
      if curl -fsS "$URL/api/health" >/dev/null 2>&1; then
        open "$URL"
        exit 0
      fi
      sleep 0.5
    done
  ) &
fi

info "SOW Architect is starting on $URL (Ctrl+C to stop)"
exec "$PYTHON" -m uvicorn server.main:app --host 127.0.0.1 --port "$PORT" --log-level warning
