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

# Migrations run automatically on serve when pb_migrations exists
exec pocketbase serve "--http=0.0.0.0:${PORT}"
