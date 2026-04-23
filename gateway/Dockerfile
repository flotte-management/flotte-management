FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci --ignore-scripts

COPY src ./src
RUN npm run build

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
