# ── Panel (React + Vite) ──────────────────────────────────────────────────────
FROM node:20-alpine AS panel-builder
WORKDIR /panel
COPY apps/panel/package*.json ./
RUN npm ci
COPY apps/panel .
RUN npm run build

# ── API (Fastify + TypeScript) ────────────────────────────────────────────────
FROM node:20-alpine AS api-builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api .
RUN npx prisma generate
RUN npx tsc

# ── Imagen de producción ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

COPY apps/api/package*.json ./
RUN npm ci --omit=dev

COPY --from=api-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=api-builder /app/dist                  ./dist
COPY --from=panel-builder /panel/dist              ./dist/public
COPY apps/api/prisma          ./prisma
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/app.js"]
