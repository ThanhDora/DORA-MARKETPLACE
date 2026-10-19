#!/usr/bin/env bash
# Vercel build for the API: generate the Prisma client, sync the schema, and
# (only when RUN_DB_SEED=1) seed demo data. Seeding is opt-in because
# prisma/seed-products.ts inserts products on every run.
set -euo pipefail
export DIRECT_DATABASE_URL="${DIRECT_DATABASE_URL:-${DATABASE_URL_UNPOOLED:-$DATABASE_URL}}"
npx prisma generate
# prisma/migrations is incomplete (the first migration does not create every
# enum/table the later ones use), so the schema is synced with db push instead.
# db push refuses destructive changes unless --accept-data-loss is passed.
npx prisma db push --skip-generate
if [ "${RUN_DB_SEED:-0}" = "1" ]; then
  npx tsx prisma/seed.ts
  npx tsx prisma/seed-products.ts
fi
if [ "${RUN_DB_IMAGE_UPDATE:-0}" = "1" ]; then
  npx tsx prisma/update-demo-images.ts
fi
