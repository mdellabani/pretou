#!/usr/bin/env bash
# Boot the full local stack: Supabase + web + mobile.
# Idempotent — Supabase start is a no-op when already running.
# Auto-syncs apps/mobile/.env.local with the host's current LAN IP so the
# phone can reach Supabase (localhost on a phone = the phone itself).
# Web runs in the background (logs to /tmp/pretou-web.log).
# Expo runs in the foreground so its QR code + keypress menu stay interactive.
# Ctrl+C stops web + Expo; Supabase is left running for fast re-launch
# (stop it manually with `npx supabase stop`).

set -euo pipefail

cd "$(dirname "$0")/.."

WEB_LOG="${TMPDIR:-/tmp}/pretou-web.log"
MOBILE_ENV="apps/mobile/.env.local"

cyan()   { printf "\033[36m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }

# Pick the first non-loopback, non-docker LAN IP.
detect_lan_ip() {
  ip -4 -o addr show scope global 2>/dev/null \
    | awk '{print $2, $4}' \
    | grep -Ev '^(docker|br-|veth|tun|tap|virbr)' \
    | awk '{split($2,a,"/"); print a[1]}' \
    | grep -v '^172\.\(1[6-9]\|2[0-9]\|3[0-1]\)\.' \
    | head -n1
}

sync_mobile_env_ip() {
  local ip=$1
  if [ ! -f "$MOBILE_ENV" ]; then
    yellow "  $MOBILE_ENV missing — skipping IP sync."
    return
  fi
  local current
  current=$(grep -oE 'EXPO_PUBLIC_SUPABASE_URL=http://[0-9.]+:54321' "$MOBILE_ENV" \
    | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' || true)
  if [ -z "$current" ]; then
    yellow "  No local Supabase URL pattern in $MOBILE_ENV — leaving as-is."
    return
  fi
  if [ "$current" = "$ip" ]; then
    cyan "  Mobile env already points at $ip ✔"
    return
  fi
  sed -i.bak -E "s|EXPO_PUBLIC_SUPABASE_URL=http://[0-9.]+:54321|EXPO_PUBLIC_SUPABASE_URL=http://$ip:54321|" "$MOBILE_ENV"
  rm -f "${MOBILE_ENV}.bak"
  yellow "  Updated $MOBILE_ENV: $current → $ip"
}

cyan "▶ Detecting LAN IP…"
LAN_IP=$(detect_lan_ip || true)
if [ -z "${LAN_IP:-}" ]; then
  red "  Could not detect a LAN IP. Connect to Wi-Fi/Ethernet and retry."
  exit 1
fi
cyan "  Host LAN IP: $LAN_IP"
sync_mobile_env_ip "$LAN_IP"

cyan "▶ Starting Supabase…"
if ! npx supabase status >/dev/null 2>&1; then
  npx supabase start
else
  echo "  (already running)"
fi

cyan "▶ Web → http://localhost:3000  (logs: tail -f $WEB_LOG)"
: > "$WEB_LOG"
pnpm --filter @pretou/web dev >>"$WEB_LOG" 2>&1 &
WEB_PID=$!

cleanup() {
  yellow "▶ Stopping web (pid $WEB_PID)…"
  kill "$WEB_PID" 2>/dev/null || true
  wait "$WEB_PID" 2>/dev/null || true
  cyan "  Supabase still running. Stop it with: npx supabase stop"
}
trap cleanup EXIT INT TERM

cyan "▶ Launching Expo → Supabase at http://$LAN_IP:54321"
pnpm --filter @pretou/mobile dev
