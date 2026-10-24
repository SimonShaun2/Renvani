#!/usr/bin/env bash
# Vercel rootDirectory=apps/web — deps via vercel-web-build-deps.sh, then next build (<256 char buildCommand).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
corepack pnpm --filter @fsm/web build
