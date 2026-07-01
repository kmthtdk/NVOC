# ---- Stage 1: build (TypeScript -> dist) ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install all deps (incl. dev) for the build.
# `npm install` (not `npm ci`) because package-lock.json is gitignored repo-wide,
# so a fresh clone has no committed lockfile for `npm ci` to consume.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune to production deps only (reused in runtime stage)
RUN npm prune --omit=dev

# ---- Stage 2: runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as the built-in non-root "node" user
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

# Uploads volume mount point (declared in docker-compose)
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
EXPOSE 4000

# Lightweight container healthcheck hitting /health
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
