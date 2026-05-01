#!/bin/sh
set -e

echo "==> Applying SQL migrations + reloading stored procedures..."
pnpm run db:migrate

echo "==> Starting SIGAH server..."
exec "$@"
