# Multi-stage build for RPi4 (arm64)
# Stage 1: Build
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/

RUN pnpm install --frozen-lockfile
RUN pnpm run build

# Stage 2: Runtime — Node server + nginx for static files
FROM node:20-slim

RUN apt-get update && apt-get install -y nginx supervisor && rm -rf /var/lib/apt/lists/*

# Copy nginx config
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default

# Copy built client
COPY --from=builder /app/apps/client/dist /usr/share/nginx/html

# Copy game server
COPY --from=builder /app/apps/server/dist /app/server/dist
COPY --from=builder /app/apps/server/package.json /app/server/
COPY --from=builder /app/packages/shared-types/dist /app/packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json /app/packages/shared-types/
COPY --from=builder /app/packages/game-core/dist /app/packages/game-core/dist
COPY --from=builder /app/packages/game-core/package.json /app/packages/game-core/

# Install production deps for server
WORKDIR /app/server
COPY --from=builder /app/node_modules/.pnpm /app/node_modules/.pnpm
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/server/node_modules /app/server/node_modules

# Supervisor config to run both nginx and node
COPY infra/docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 80

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
