# Multi-stage build for the Synapse collab (WebSocket) service (context = repo root)
FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/collab/package.json apps/collab/
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/collab apps/collab
RUN npm run build --workspace @synapse/collab

FROM deps AS prod-deps
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/collab/dist ./apps/collab/dist
COPY --from=build /app/apps/collab/package.json ./apps/collab/
USER node
EXPOSE 4001
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4001/healthz || exit 1
CMD ["node", "apps/collab/dist/index.js"]
