#!/bin/zsh
set -euo pipefail

ROOT="/Users/a1/Mybeebot"
LOG_DIR="$ROOT/logs"
URL_FILE="$ROOT/ops/cloudflared/current-url.txt"
CONFIG_FILE="$ROOT/ops/cloudflared/config.yml"
OUT_LOG="$LOG_DIR/quick-tunnel.out.log"
ERR_LOG="$LOG_DIR/quick-tunnel.err.log"
CLOUDFLARED_BIN="/usr/local/bin/cloudflared"

mkdir -p "$LOG_DIR"
: > "$OUT_LOG"
: > "$ERR_LOG"

deploy_worker_proxy() {
  local url="$1"
  local previous=""

  if [[ -f "$URL_FILE" ]]; then
    previous=$(cat "$URL_FILE")
  fi

  if [[ "$url" == "$previous" ]]; then
    return
  fi

  printf '%s' "$url" > "$URL_FILE"
  printf '[deploy] Updating worker tunnel proxy to %s\n' "$url" | tee -a "$OUT_LOG"
  (
    cd "$ROOT"
    /usr/local/bin/npm run build >/dev/null
    /usr/local/bin/npx wrangler deploy --var BOT_TUNNEL_URL:"$url" --keep-vars >>"$OUT_LOG" 2>>"$ERR_LOG"
  )
}

named_tunnel_hostname() {
  [[ -f "$CONFIG_FILE" ]] || return 1
  awk '/^[[:space:]]*-[[:space:]]+hostname:/ { print $3; exit } /^[[:space:]]*hostname:/ { print $2; exit }' "$CONFIG_FILE"
}

named_tunnel_credentials() {
  [[ -f "$CONFIG_FILE" ]] || return 1
  awk '/^credentials-file:/ { print $2; exit }' "$CONFIG_FILE"
}

run_named_tunnel() {
  local hostname="$1"
  local credentials_file="$2"

  if [[ -z "$hostname" || -z "$credentials_file" || ! -f "$credentials_file" ]]; then
    return 1
  fi

  local stable_url="https://$hostname"
  printf '[tunnel] Starting named tunnel for %s via http2\n' "$stable_url" | tee -a "$OUT_LOG"
  deploy_worker_proxy "$stable_url"
  exec "$CLOUDFLARED_BIN" tunnel --protocol http2 --config "$CONFIG_FILE" run 2>&1 | tee -a "$OUT_LOG"
}

hostname="$(named_tunnel_hostname || true)"
credentials_file="$(named_tunnel_credentials || true)"
if [[ -n "${hostname:-}" && -n "${credentials_file:-}" && -f "$credentials_file" ]]; then
  run_named_tunnel "$hostname" "$credentials_file"
fi

printf '[tunnel] Named tunnel not ready, falling back to quick tunnel via http2\n' | tee -a "$OUT_LOG"
"$CLOUDFLARED_BIN" tunnel --protocol http2 --url http://127.0.0.1:8788 2>&1 | while IFS= read -r line; do
  printf '%s\n' "$line" | tee -a "$OUT_LOG"

  if [[ "$line" == *"https://"*".trycloudflare.com"* ]]; then
    url=$(printf '%s\n' "$line" | grep -Eo 'https://[^[:space:]]+\.trycloudflare\.com' | head -n 1 || true)

    if [[ -n "${url:-}" ]]; then
      deploy_worker_proxy "$url"
    fi
  fi
done
