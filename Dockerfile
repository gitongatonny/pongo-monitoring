# syntax=docker/dockerfile:1
FROM oven/bun:1.4.5-slim@sha256:b780593f3e10918cbdaec3d5a08d52224b9198069a65eb47812085c2ec007643 AS base
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts
COPY . .
ARG PONGO_BUILD_COMMIT
ARG NEXT_PUBLIC_URL
RUN bun run build && rm -rf .next/cache

FROM base AS runtime-dependencies
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --ignore-scripts

FROM cgr.dev/chainguard/glibc-dynamic:latest@sha256:3359c6ba6b3bcf3b1d2179849f782365564cb262789e732e2833b25b9a8c00f1
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=base /usr/local/bin/bun /usr/local/bin/bun
ARG PONGO_BUILD_COMMIT
LABEL org.opencontainers.image.revision=$PONGO_BUILD_COMMIT
ENV PORT=3000 SCHEDULER_ENABLED=false ARCHIVAL_ENABLED=false
COPY --from=runtime-dependencies --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /app/.next ./.next
COPY --chown=65532:65532 package.json tsconfig.json next.config.ts README.md LICENSE docker-entrypoint.js ./
COPY --chown=65532:65532 src ./src
COPY --chown=65532:65532 public ./public
COPY --chown=65532:65532 pongo ./pongo
COPY --chown=65532:65532 drizzle ./drizzle
COPY --chown=65532:65532 scripts/migrate-postgres.ts ./scripts/migrate-postgres.ts
USER 65532:65532
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
    CMD ["bun", "-e", "const r = await fetch('http://127.0.0.1:' + process.env.PORT + '/health'); if (!r.ok) process.exit(1)"]
ENTRYPOINT ["bun", "/app/docker-entrypoint.js"]
CMD ["bun", "run", "start"]
