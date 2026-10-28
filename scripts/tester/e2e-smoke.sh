#!/usr/bin/env bash
# out() always returns 0, so `cond && out PASS || out FAIL` is a safe if/else here.
# shellcheck disable=SC2015
# Tester-flow smoke for a deployed Renvani environment (Stripe TEST mode only).
# Extends the check style of scripts/render/smoke.sh (PR #258); does not modify it.
#
# Flow: health -> sign up (legacy JWT register+login) -> onboard -> import customers
#       -> create job -> create invoice -> send (Stripe Checkout link) -> pay (TEST) .
# Output: one line per step: PASS | FAIL | SKIP | GAP | DRY. Exit 1 if any FAIL.
#
# Env (names only; values are never printed):
#   API_BASE_URL       required (e.g. https://renvani-api.onrender.com)
#   WEB_BASE_URL       optional (web app; pay page check)
#   WEBHOOK_BASE_URL   optional (webhook service; unsigned-reject check)
#   TESTER_EMAIL / TESTER_PASSWORD  optional; default = unique smoke+<ts>@example.com / random
#   TESTER_ACCESS_TOKEN optional; skip register/login and use this bearer token
#   SMOKE_IMPORT_FIXTURE  default packages/config/fixtures/import-golden-bundles/qbo/customers.csv
#   SMOKE_IMPORT_TIMEOUT_SECONDS default 180;  SMOKE_TIMEOUT_SECONDS default 20
#   SMOKE_WAIT_FOR_PAYMENT=1  poll invoice for "paid" after a human pays the TEST checkout link
#
# Usage: scripts/tester/e2e-smoke.sh [--dry-run]
#   --dry-run : no network; prints every step and its GAP/SKIP reasons to prove the format.
set -uo pipefail

DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TIMEOUT="${SMOKE_TIMEOUT_SECONDS:-20}"
IMPORT_TIMEOUT="${SMOKE_IMPORT_TIMEOUT_SECONDS:-180}"
FIXTURE="${SMOKE_IMPORT_FIXTURE:-$ROOT/packages/config/fixtures/import-golden-bundles/qbo/customers.csv}"
API="${API_BASE_URL:-}"
BODY="$(mktemp)"; trap 'rm -f "$BODY"' EXIT
fails=0; passes=0; gaps=0; skips=0
TOKEN="${TESTER_ACCESS_TOKEN:-}"
CUSTOMER_ID=""; JOB_ID=""; INVOICE_ID=""

out() { # status label detail
  printf '%-4s  %-34s %s\n' "$1" "$2" "${3:-}"
  case "$1" in PASS) passes=$((passes+1));; FAIL) fails=$((fails+1));; GAP) gaps=$((gaps+1));; SKIP) skips=$((skips+1));; esac
}
need() { command -v "$1" >/dev/null 2>&1 || { echo "FAIL  prerequisite: $1 not installed"; exit 1; }; }

# http METHOD PATH [json-body]  -> sets CODE, body in $BODY. Token is sent as a header, never echoed.
http() {
  local m="$1" p="$2" d="${3:-}"
  local args=(-sS -o "$BODY" -w '%{http_code}' --max-time "$TIMEOUT" -X "$m")
  [[ -n "$TOKEN" ]] && args+=(-H "authorization: Bearer $TOKEN")
  [[ -n "$d" ]] && args+=(-H 'content-type: application/json' --data "$d")
  CODE="$(curl "${args[@]}" "$API$p" 2>/dev/null)" || true
}
jget() { jq -r "$1 // empty" "$BODY" 2>/dev/null; }
anyid() { jget '(.id // .invoice.id // .job.id // .customer.id // .importSession.id // .session.id // .bundle.id // .data.id)'; }
brief() { head -c 200 "$BODY" 2>/dev/null | tr -d '\r\n'; }

if [[ "$DRY" == 1 ]]; then
  echo "== tester e2e smoke (DRY RUN: no network) =="
  for s in "health /health/live,/health/ready" "sign up: register+login (legacy JWT)" "onboard: GET /api/v1/company" \
           "onboard: POST migrate/onboarding/sessions" "import customers: upload $(basename "$FIXTURE")" \
           "import customers: AI mapping->confirm" "import customers: start->completed" "create customer (fallback)" \
           "create job" "create invoice" "stripe: connect status" "send invoice (Checkout link)"; do
    out DRY "$s" "would call API_BASE_URL"
  done
  [[ -f "$FIXTURE" ]] && out PASS "fixture present" "${FIXTURE#"$ROOT"/}" || out FAIL "fixture present" "$FIXTURE missing"
  out GAP "sign up via Clerk" "needs browser + Clerk hosted UI; see runbook G1"
  out GAP "stripe connect onboarding" "Stripe-hosted Express onboarding needs browser; see runbook G3"
  out GAP "pay invoice (Stripe TEST)" "Checkout is browser-only; paid status needs webhook; see runbook G4"
  echo "summary: pass=$passes fail=$fails gap=$gaps skip=$skips (dry run)"
  [[ "$fails" -gt 0 ]] && exit 1; exit 0
fi

need curl; need jq
[[ -n "$API" ]] || { echo "FAIL  API_BASE_URL not set"; exit 1; }
echo "== tester e2e smoke against API_BASE_URL (values not printed) =="

# 1. health
for p in /health/live /health/ready; do
  http GET "$p"; [[ "$CODE" == 200 ]] && out PASS "health $p" "$CODE" || out FAIL "health $p" "$CODE $(brief)"
done
if [[ -n "${WEBHOOK_BASE_URL:-}" ]]; then
  c="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" -X POST -H 'content-type: application/json' --data '{}' "$WEBHOOK_BASE_URL/stripe")" || true
  [[ "$c" =~ ^4 ]] && out PASS "webhook rejects unsigned stripe" "$c" || out FAIL "webhook rejects unsigned stripe" "$c"
else out SKIP "webhook rejects unsigned stripe" "WEBHOOK_BASE_URL unset"; fi

# 2. sign up
out GAP "sign up via Clerk" "browser-only; runbook G1 (legacy JWT path used below)"
if [[ -z "$TOKEN" ]]; then
  ts="$(date +%s)"; EMAIL="${TESTER_EMAIL:-smoke+$ts@example.com}"
  PASS_="${TESTER_PASSWORD:-Smoke-$(head -c 9 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
  reg="$(jq -nc --arg e "$EMAIL" --arg p "$PASS_" '{companyName:"Smoke Test Co",firstName:"Smoke",lastName:"Tester",email:$e,password:$p}')"
  http POST /api/v1/auth/register "$reg"
  case "$CODE" in 202|200|201) out PASS "register (legacy)" "$CODE";; 409) out SKIP "register (legacy)" "409 already exists";; 429) out FAIL "register (legacy)" "429 rate limited (runbook B4)";; *) out FAIL "register (legacy)" "$CODE $(brief)";; esac
  http POST /api/v1/auth/login "$(jq -nc --arg e "$EMAIL" --arg p "$PASS_" '{email:$e,password:$p}')"
  TOKEN="$(jget '.tokens.accessToken')"
  [[ "$CODE" == 200 && -n "$TOKEN" ]] && out PASS "login (legacy JWT)" "$CODE" || out FAIL "login (legacy JWT)" "$CODE $(brief)"
else out SKIP "register+login" "TESTER_ACCESS_TOKEN supplied"; fi
if [[ -z "$TOKEN" ]]; then echo "summary: pass=$passes fail=$fails gap=$gaps skip=$skips (no token; stopping)"; exit 1; fi

# 3. onboard
http GET /api/v1/company; [[ "$CODE" == 200 ]] && out PASS "onboard: GET company" "$CODE" || out FAIL "onboard: GET company" "$CODE $(brief)"
http POST /api/v1/migrate/onboarding/sessions '{"resumeActive":true}'
[[ "$CODE" =~ ^20 ]] && out PASS "onboard: migrate session" "$CODE" || out FAIL "onboard: migrate session" "$CODE $(brief)"

# 4. import customers (existing golden fixture)
IMPORT_ID=""
CODE="$(curl -sS -o "$BODY" -w '%{http_code}' --max-time "$TIMEOUT" -H "authorization: Bearer $TOKEN" \
  -F "entityType=customers" -F "file=@$FIXTURE;type=text/csv" "$API/api/v1/imports" 2>/dev/null)" || true
IMPORT_ID="$(anyid)"
[[ "$CODE" =~ ^20 && -n "$IMPORT_ID" ]] && out PASS "import: upload fixture" "$CODE" || out FAIL "import: upload fixture" "$CODE $(brief)"
poll_status() { # wanted-status...
  local end=$((SECONDS + IMPORT_TIMEOUT)) st=""
  while (( SECONDS < end )); do
    http GET "/api/v1/imports/$IMPORT_ID"; st="$(jget '(.status // .importSession.status)')"
    for w in "$@"; do [[ "$st" == "$w" ]] && { echo "$st"; return 0; }; done
    [[ "$st" == failed ]] && { echo failed; return 1; }
    sleep 3
  done; echo "${st:-timeout}"; return 1
}
if [[ -n "$IMPORT_ID" ]]; then
  if st="$(poll_status mapping)"; then
    out PASS "import: worker mapped columns" "$st"
    http POST "/api/v1/imports/$IMPORT_ID/confirm-mapping" '{"mappingOverrides":{}}'
    [[ "$CODE" =~ ^20 ]] && out PASS "import: confirm mapping" "$CODE" || out FAIL "import: confirm mapping" "$CODE $(brief)"
    if st="$(poll_status preview)"; then
      http POST "/api/v1/imports/$IMPORT_ID/start" '{"duplicateActions":{}}'
      [[ "$CODE" =~ ^20 ]] && out PASS "import: start" "$CODE" || out FAIL "import: start" "$CODE $(brief)"
      st="$(poll_status completed)" && out PASS "import: completed" "$st" || out FAIL "import: completed" "status=$st (worker/R2, runbook B2)"
    else out FAIL "import: validation->preview" "status=$st (worker, runbook B2)"; fi
  else out FAIL "import: worker mapped columns" "status=$st (worker/Redis/R2/OPENAI_API_KEY, runbook B2)"; fi
else out SKIP "import: processing" "no import id"; fi

# 5. customer for job/invoice: create one with an email (send requires customer.email)
http POST /api/v1/customers "$(jq -nc --arg e "smoke-customer+$(date +%s)@example.com" '{firstName:"Smoke",lastName:"Customer",email:$e}')"
CUSTOMER_ID="$(anyid)"
[[ "$CODE" =~ ^20 && -n "$CUSTOMER_ID" ]] && out PASS "create customer" "$CODE" || out FAIL "create customer" "$CODE $(brief)"

# 6. job
if [[ -n "$CUSTOMER_ID" ]]; then
  http POST /api/v1/jobs "$(jq -nc --arg c "$CUSTOMER_ID" '{customerId:$c,title:"Smoke test service call"}')"; JOB_ID="$(anyid)"
  [[ "$CODE" =~ ^20 && -n "$JOB_ID" ]] && out PASS "create job" "$CODE" || out FAIL "create job" "$CODE $(brief)"
else out SKIP "create job" "no customer"; fi

# 7. invoice
if [[ -n "$CUSTOMER_ID" ]]; then
  inv="$(jq -nc --arg c "$CUSTOMER_ID" --arg j "$JOB_ID" '{customerId:$c,title:"Smoke invoice",items:[{name:"Diagnostic",quantity:1,unitPrice:1}]} + (if $j=="" then {} else {jobId:$j} end)')"
  http POST /api/v1/invoices "$inv"; INVOICE_ID="$(anyid)"
  [[ "$CODE" =~ ^20 && -n "$INVOICE_ID" ]] && out PASS "create invoice" "$CODE" || out FAIL "create invoice" "$CODE $(brief)"
else out SKIP "create invoice" "no customer"; fi

# 8. Stripe TEST: connect status -> send -> pay
http GET /api/v1/stripe/connect/status
connected="$(jget '.connected')"; charges="$(jget '.chargesEnabled')"
if [[ "$CODE" == 200 && "$connected" == true && "$charges" == true ]]; then
  out PASS "stripe connect (test acct)" "connected, charges enabled"
  if [[ -n "$INVOICE_ID" ]]; then
    http POST "/api/v1/invoices/$INVOICE_ID/send" '{}'
    link="$(jget '(.stripePaymentLinkUrl // .invoice.stripePaymentLinkUrl)')"
    [[ "$CODE" =~ ^20 && -n "$link" ]] && out PASS "send invoice (checkout link)" "$CODE" || out FAIL "send invoice (checkout link)" "$CODE $(brief)"
    if [[ "${SMOKE_WAIT_FOR_PAYMENT:-0}" == 1 && -n "$link" ]]; then
      echo "      pay in browser with Stripe TEST card 4242 4242 4242 4242: $link"
      paid=""; end=$((SECONDS + 600))
      while (( SECONDS < end )); do http GET "/api/v1/invoices/$INVOICE_ID"; s="$(jget '(.status // .invoice.status)')"; [[ "$s" == paid ]] && { paid=1; break; }; sleep 5; done
      [[ -n "$paid" ]] && out PASS "pay invoice (Stripe TEST)" "paid via webhook" || out FAIL "pay invoice (Stripe TEST)" "not paid in 10m (webhook, runbook B5)"
    else out GAP "pay invoice (Stripe TEST)" "Checkout is browser-only; set SMOKE_WAIT_FOR_PAYMENT=1 (runbook G4)"; fi
  fi
else
  out GAP "stripe connect onboarding" "connected=${connected:-?} chargesEnabled=${charges:-?} (HTTP $CODE); runbook G3"
  out SKIP "send invoice" "requires company.stripeAccountId (409 otherwise)"
  out GAP "pay invoice (Stripe TEST)" "blocked by connect onboarding; runbook G3/G4"
fi

# 9. web
if [[ -n "${WEB_BASE_URL:-}" ]]; then
  c="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$WEB_BASE_URL/")" || true
  case "$c" in 200) out PASS "web root" "$c";; 401|302|307) out FAIL "web root" "$c (Vercel Deployment Protection? runbook B6)";; *) out FAIL "web root" "$c";; esac
else out SKIP "web root" "WEB_BASE_URL unset"; fi

echo "summary: pass=$passes fail=$fails gap=$gaps skip=$skips"
[[ "$fails" -gt 0 ]] && exit 1; exit 0
