#!/bin/sh
set -e

# Defaults (can be overridden by env)
: "${PORT:=8090}"

cd /pb

# Create/update admin user if credentials are provided
if [ -n "${PB_ADMIN_EMAIL}" ] && [ -n "${PB_ADMIN_PASSWORD}" ]; then
  echo "Creating/updating admin user..."
  pocketbase superuser upsert "${PB_ADMIN_EMAIL}" "${PB_ADMIN_PASSWORD}"
fi

# If we have admin credentials, start server in background, fetch API token, print it, then keep server in foreground
if [ -n "${PB_ADMIN_EMAIL}" ] && [ -n "${PB_ADMIN_PASSWORD}" ]; then
  pocketbase serve "--http=0.0.0.0:${PORT}" &
  PB_PID=$!

  # Wait for API to be ready (max ~15s)
  i=0
  while [ $i -lt 15 ]; do
    if wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" 2>/dev/null; then
      break
    fi
    i=$(( i + 1 ))
    sleep 1
  done

  if [ $i -lt 15 ]; then
    RESP=$(wget -qO- --post-data="{\"identity\":\"${PB_ADMIN_EMAIL}\",\"password\":\"${PB_ADMIN_PASSWORD}\"}" \
      --header="Content-Type: application/json" \
      "http://127.0.0.1:${PORT}/api/admins/auth-with-password" 2>/dev/null || true)
    if [ -n "$RESP" ]; then
      TOKEN=$(echo "$RESP" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
      if [ -n "$TOKEN" ]; then
        echo ""
        echo "--- Vaultship API key (use for: vaultship config set apiKey <key>) ---"
        echo "$TOKEN"
        echo "----------------------------------------------------------------------"
        echo ""
      fi
    fi
  fi

  wait $PB_PID
else
  exec pocketbase serve "--http=0.0.0.0:${PORT}"
fi
