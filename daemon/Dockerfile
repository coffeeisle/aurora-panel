FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun build src/index.ts --target bun --outdir dist

FROM oven/bun:1 AS runner
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist ./dist
RUN mkdir -p /servers /data && chown -R app:app /servers /data
USER app
ENV NODE_ENV=production
EXPOSE 8443
CMD ["bun", "./dist/index.js"]
