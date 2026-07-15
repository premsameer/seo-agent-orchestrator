#!/usr/bin/env bash
# Render / container start: ensure the Hermes CLI worker is present, then boot.
set -euo pipefail

if ! command -v hermes >/dev/null 2>&1; then
  echo "hermes CLI not found on PATH; installing..." >&2
  npm install -g hermes-cli
fi

if [ ! -d "${HERMES_HOME:-$HOME/.hermes}" ]; then
  echo "WARNING: authenticated ~/.hermes not found. Live runs will fail until credentials are mounted." >&2
fi

exec npm run start
