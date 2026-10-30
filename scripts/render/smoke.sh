#!/usr/bin/env bash
# Render post-deploy smoke test (read-only HTTP GETs/HEADs; sends no credentials, prints no secrets).
#
# Usage:
#   API_BASE_URL=https://renvani-api.onrender.com \
#   WEBHOOK_BASE_URL=https://renvani-webhook.onrender.com \
#   scripts/render/smoke.sh
#
# Exit code 0 = all checks passed. The worker has no HTTP port: confirm it in the Render
# dashboard logs ("worker started") and via the API readiness redis check below.
set -euo pipefail

API_BASE_URL="${API_BASE_URL:?set API_BASE_URL (e.g. https://renvani-api.onrender.com)}"
WEBHOOK_BASE_URL="${WEBHOOK_BASE_URL:?set WEBHOOK_BASE_URL (e.g. https://renvani-webhook.onrender.com)}"
TIMEOUT="${SMOKE_TIMEOUT_SECONDS:-20}"
failures=0

check() {
  local label="$1" url="$2" expected="$3"
  local code
  code="$(curl -sS -o /tmp/renvani-smoke-body -w '%{http_code}' --max-time "$TIMEOUT" "$url" || echo "000")"
  if [[ ",$expected," == *",$code,"* ]]; then
    printf 'PASS  %-28s %s -> %s\n' "$label" "$url" "$code"
  else
    printf 'FAIL  %-28s %s -> %s (expected %s)\n' "$label" "$url" "$code" "$expected"
    head -c 400 /tmp/renvani-smoke-body 2>/dev/null | tr -d '\r'; echo
    failures=$((failures + 1))
  fi
}

check "api liveness"            "$API_BASE_URL/health/live"    200
check "api readiness (db+redis+storage)" "$API_BASE_URL/health/ready" 200
check "api db"                  "$API_BASE_URL/health/db"      200
check "api redis (BullMQ KV)"   "$API_BASE_URL/health/redis"   200
check "api storage (R2)"        "$API_BASE_URL/health/storage" 200
check "webhook liveness"        "$WEBHOOK_BASE_URL/health"     200
# Signature verification must reject unsigned posts (never 2xx).
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" -X POST -H 'content-type: application/json' --data '{}' "$WEBHOOK_BASE_URL/stripe" || echo 000)"
if [[ "$code" =~ ^4 ]]; then
  echo "PASS  webhook rejects unsigned Stripe  -> $code"
else
  echo "FAIL  webhook rejects unsigned Stripe  -> $code (expected 4xx)"; failures=$((failures + 1))
fi

if [[ "$failures" -gt 0 ]]; then
  echo "smoke: $failures check(s) failed"; exit 1
fi
echo "smoke: all checks passed"
