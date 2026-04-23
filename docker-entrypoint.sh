#!/bin/sh
set -e

echo "==> Applying Prisma migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "==> Starting SIGAH server..."
exec "$@"
