#!/bin/zsh
set -euo pipefail

ROOT="/Users/a1/Mybeebot"
LOG_DIR="$ROOT/logs"
URL_FILE="$ROOT/ops/cloudflared/current-url.txt"
OUT_LOG="$LOG_DIR/quick-tunnel.out.log"
ERR_LOG="$LOG_DIR/quick-tunnel.err.log"

mkdir -p "$LOG_DIR"
: > "$OUT_LOG"
: > "$ERR_LOG"

/usr/local/bin/cloudflared tunnel --url http://127.0.0.1:8788 2>&1 | while IFS= read -r line; do
  printf '%s\n' "$line" | tee -a "$OUT_LOG"

  if [[ "$line" == *"https://"*".trycloudflare.com"* ]]; then
    url=$(printf '%s\n' "$line" | grep -Eo 'https://[^[:space:]]+\.trycloudflare\.com' | head -n 1 || true)

    if [[ -n "${url:-}" ]]; then
      previous=""
      if [[ -f "$URL_FILE" ]]; then
        previous=$(cat "$URL_FILE")
      fi

      if [[ "$url" != "$previous" ]]; then
        printf '%s' "$url" > "$URL_FILE"
        printf '[deploy] Updating worker tunnel proxy to %s\n' "$url" | tee -a "$OUT_LOG"
        (
          cd "$ROOT"
          /usr/local/bin/npm run build >/dev/null
          /usr/local/bin/npx wrangler deploy --var BOT_TUNNEL_URL:"$url" --keep-vars >>"$OUT_LOG" 2>>"$ERR_LOG"
        )
      fi
    fi
  fi
done
