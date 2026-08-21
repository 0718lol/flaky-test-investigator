#!/usr/bin/env sh
set -eu

if [ -z "${PORT:-}" ]; then
  echo "PORT is required" >&2
  exit 1
fi

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
SOURCE="$ROOT/source"

NODE_CMD="$(command -v node || true)"
if [ -z "$NODE_CMD" ]; then
  echo "node runtime is missing from PATH" >&2
  exit 1
fi

if [ ! -f "$ROOT/.encryption_key" ]; then
  openssl rand -hex 32 > "$ROOT/.encryption_key"
fi

mkdir -p "$ROOT/data/logs" "$ROOT/uploads/files" "$ROOT/uploads/covers" "$ROOT/uploads/avatars" "$ROOT/uploads/photos"

if [ -d "$SOURCE/client/dist" ]; then
  mkdir -p "$SOURCE/server/public"
  cp -R "$SOURCE/client/dist/." "$SOURCE/server/public/"
fi

export NODE_ENV=production
export HOST=0.0.0.0
export PORT="$PORT"
export ENCRYPTION_KEY="$(cat "$ROOT/.encryption_key")"
export LOG_LEVEL="${LOG_LEVEL:-info}"

cd "$SOURCE/server"
exec "$NODE_CMD" --require tsconfig-paths/register dist/index.js
