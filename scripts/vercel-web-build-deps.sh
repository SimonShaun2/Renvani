#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
corepack enable
corepack pnpm -r --filter @fsm/import-normalize --filter @fsm/types --filter @fsm/comms build
corepack pnpm --filter @fsm/import-engine build
corepack pnpm --filter @fsm/config build
corepack pnpm --filter @fsm/db build
corepack pnpm --filter @fsm/observability build
corepack pnpm --filter @fsm/jobs build
corepack pnpm --filter @fsm/ai build
