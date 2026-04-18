# =============================================================================
#  Dockerfile — service-missions (NestJS)
#  Multi-stage : development | build | production
# =============================================================================

# ─── Stage 1 : base commune ──────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# ─── Stage 2 : développement (hot-reload) ────────────────────────────────────
FROM base AS development
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3005
CMD ["dumb-init", "npm", "run", "start:dev"]

# ... (Stages 1 et 2 inchangés)

# ─── Stage 3 : compilation TypeScript ────────────────────────────────────────
FROM base AS builder
# On installe TOUT pour pouvoir builder (pas de --omit=dev ici)
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# On fait le ménage APRES le build pour ne garder que la prod
# Cela réduit la taille du dossier node_modules pour le Stage 4
RUN npm prune --omit=dev

# ─── Stage 4 : image de production (minimale) ────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production

# On récupère le build ET les node_modules nettoyés
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Utilisateur non-root
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup
USER appuser

EXPOSE 3005
# ... reste du fichier
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3005/health || exit 1

CMD ["dumb-init", "node", "dist/main"]
