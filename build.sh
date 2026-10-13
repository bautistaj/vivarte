#!/bin/sh
# Construye panel + API y levanta el servidor en http://localhost:3000
# Uso: ./build.sh
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "── Panel ────────────────────────────────────"
cd "$ROOT/apps/panel"
# Base '/' para local (sin prefijo /vivarte)
VITE_BASE_PATH=/ npm run build

echo "── Copiando panel → API ─────────────────────"
rm -rf "$ROOT/apps/api/dist/public"
mkdir -p "$ROOT/apps/api/dist/public"
cp -r dist/. "$ROOT/apps/api/dist/public/"

echo "── API ──────────────────────────────────────"
cd "$ROOT/apps/api"
npx prisma generate
npx tsc

echo "── Listo — inicia con: ──────────────────────"
echo "  cd apps/api && DATABASE_URL=file:./dev.db JWT_SECRET=dev node dist/app.js"
