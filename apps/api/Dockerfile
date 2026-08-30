# syntax=docker/dockerfile:1

###############################################################################
# Multi-stage build from the monorepo root.
#   docker build -f apps/api/Dockerfile .
###############################################################################

ARG NODE_VERSION=24-alpine

# --- Stage 1: install and compile --------------------------------------------
FROM node:${NODE_VERSION} AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/mobile/package.json ./apps/mobile/
COPY apps/api/prisma ./apps/api/prisma
RUN npm ci

COPY apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/api/src ./apps/api/src
RUN npm run build -w api
RUN npm prune --omit=dev

# --- Stage 2: runtime --------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

# yt-dlp for YouTube preview. Keep in sync with Dockerfile.worker (worker also adds ffmpeg).
# Do not use `apk add yt-dlp` — Alpine's package is too stale for YouTube.
RUN apk add --no-cache ca-certificates python3 py3-pip \
  && pip3 install --no-cache-dir --break-system-packages yt-dlp \
  && yt-dlp --version

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
