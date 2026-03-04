#!/bin/sh
set -e

: "${PORT:=8090}"
: "${DB_PATH:=/data/vaultship.db}"
: "${DATA_DIR:=/data}"
: "${PRINT_API_KEY:=false}"

mkdir -p "${DATA_DIR}"

API_KEY_FILE="${DATA_DIR}/api-key"

if [ -n "${VAULTSHIP_API_KEY}" ]; then
  API_KEY="${VAULTSHIP_API_KEY}"
elif [ -f "${API_KEY_FILE}" ]; then
  API_KEY=$(cat "${API_KEY_FILE}")
else
  API_KEY=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")
  printf "%s" "${API_KEY}" > "${API_KEY_FILE}"
  chmod 600 "${API_KEY_FILE}" || true
  echo ""
  echo "--- Vaultship API key (use for: vaultship config set apiKey <key>) ---"
  echo "${API_KEY}"
  echo "----------------------------------------------------------------------"
  echo ""
fi

if [ "${PRINT_API_KEY}" = "true" ]; then
  echo ""
  echo "--- Vaultship API key (use for: vaultship config set apiKey <key>) ---"
  echo "${API_KEY}"
  echo "----------------------------------------------------------------------"
  echo ""
fi

export PORT
export DB_PATH
export VAULTSHIP_API_KEY="${API_KEY}"

exec node /app/server.js
