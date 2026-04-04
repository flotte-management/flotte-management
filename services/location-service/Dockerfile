# ─────────────────────────────────────────
# Étape 1 : Build TypeScript
# ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build          # compile TypeScript → dist/

# ─────────────────────────────────────────
# Étape 2 : Image de production
# ─────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Utilisateur non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

USER appuser

EXPOSE 3000
EXPOSE 3001

CMD ["node", "dist/main"]
