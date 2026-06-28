FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun build src/index.ts --target bun --outdir dist

FROM oven/bun:1 AS runner
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq wget 2>/dev/null | tail -1
COPY --from=builder /app/dist ./dist
RUN mkdir -p /servers /data
ENV NODE_ENV=production
EXPOSE 8443
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
	CMD wget --no-verbose --tries=1 --spider http://localhost:8443/health || exit 1
CMD ["bun", "./dist/index.js"]
