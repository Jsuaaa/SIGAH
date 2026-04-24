#!/bin/sh
set -e

echo "==> Applying Prisma migrations (prisma migrate deploy)..."
pnpm exec prisma migrate deploy

echo "==> Starting SIGAH server..."
exec "$@"
