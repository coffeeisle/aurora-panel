FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production=false
COPY . .
RUN bun run build

FROM oven/bun:1 AS runner
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
RUN chown -R app:app /app
USER app
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --spider http://localhost:3000/login || exit 1
CMD ["bun", "./build/index.js"]
