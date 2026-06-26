FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile --production=false
COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runner
WORKDIR /app

RUN addgroup -S aurora && adduser -S aurora -G aurora

ENV NODE_ENV=production \
	PORT=3000 \
	BODY_SIZE_LIMIT=Infinity \
	DATABASE_URL=file:./data/aurora.db

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p /app/data /app/servers && chown -R aurora:aurora /app

USER aurora
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
	CMD wget --no-verbose --tries=1 --spider http://localhost:3000/login || exit 1

STOPSIGNAL SIGTERM
CMD ["bun", "./build/index.js"]
