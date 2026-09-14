#!/bin/zsh
cd "${0:A:h}"

NODE_BIN="$PWD/portfolio-runtime/macos-arm64/node"
if [[ ! -x "$NODE_BIN" ]]; then NODE_BIN="$PWD/../portfolio/portfolio-runtime/macos-arm64/node"; fi
if [[ ! -x "$NODE_BIN" ]]; then NODE_BIN="/Users/lars/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; fi
if [[ ! -x "$NODE_BIN" ]]; then NODE_BIN="$(command -v node)"; fi
if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js kon niet worden gevonden."
  read -k 1 "?Druk op een toets om te sluiten."
  exit 1
fi

"$NODE_BIN" portfolio-admin-server.js &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM
sleep 1
open "http://127.0.0.1:4173/admin"
wait "$SERVER_PID"
