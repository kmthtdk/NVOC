# ---- Stage 1: build (TypeScript -> dist) ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install all deps (incl. dev) for the build.
# `npm ci` — the lockfile is committed (un-ignored for this project in the repo
# root .gitignore), so the image builds from exactly the pinned tree. `npm
# install` would silently float every rebuild to the latest semver-compatible
# versions, which is how a build that passed yesterday breaks today.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune to production deps only (reused in runtime stage)
RUN npm prune --omit=dev

# ---- Stage 2: runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Build identity, baked into the image. The airgapped Production PC has no git
# and no registry to interrogate, so the image must carry its own version and
# report it at GET /api/version.
ARG APP_VERSION=0.0.0-dev
ARG BUILD_TIME=unknown
ARG GIT_COMMIT=unknown
ENV APP_VERSION=$APP_VERSION
ENV BUILD_TIME=$BUILD_TIME
ENV GIT_COMMIT=$GIT_COMMIT

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
