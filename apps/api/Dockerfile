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
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/contracts/package.json packages/contracts/tsconfig.json packages/contracts/tsconfig.build.json ./packages/contracts/
COPY packages/contracts/src ./packages/contracts/src
COPY apps/api/prisma ./apps/api/prisma
# prisma generate reads DATABASE_URL from the schema. No database is contacted at build time.
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recipe_api
# Install the API and its workspace dependency only. The root lockfile also
# contains the Expo app, which is not needed in this image.
RUN npm ci -w api -w @recipe/contracts
RUN npm run build -w @recipe/contracts

COPY apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/api/src ./apps/api/src
RUN npm run build -w api
RUN npm prune --omit=dev
# prisma is a devDependency. Install the CLI outside the workspace so migrate
# deploy does not re-resolve the Expo app's peer dependencies.
RUN npm install --prefix /opt/prisma-cli --no-save --package-lock=false prisma@6.19.3

# --- Stage 2: runtime --------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

# yt-dlp for YouTube preview. Keep in sync with Dockerfile.worker (worker also adds ffmpeg).
# Do not use `apk add yt-dlp` — Alpine's package is too stale for YouTube.
RUN apk add --no-cache ca-certificates openssl python3 py3-pip \
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
COPY --from=build --chown=node:node /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=node:node /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /opt/prisma-cli /opt/prisma-cli

ENV PATH="/opt/prisma-cli/node_modules/.bin:${PATH}"

RUN mkdir -p /app/apps/api/logs /app/apps/api/storage && chown -R node:node /app/apps/api/logs /app/apps/api/storage

WORKDIR /app/apps/api
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
