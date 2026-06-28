FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq python3 make gcc g++ 2>/dev/null | tail -3
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm rebuild better-sqlite3 2>&1 | tail -3
RUN mkdir -p /app/data && npm run build

FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq wget 2>/dev/null | tail -1 && \
    groupadd -r aurora && useradd -r -g aurora -d /app aurora

ENV NODE_ENV=production \
	PORT=3000 \
	BODY_SIZE_LIMIT=Infinity \
	DATABASE_URL=file:./data/aurora.db

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY start.js ./

RUN mkdir -p /app/data /app/servers && chown -R aurora:aurora /app

USER aurora
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
	CMD wget --no-verbose --tries=1 --spider http://localhost:3000/login || exit 1

STOPSIGNAL SIGTERM
CMD ["node", "./start.js"]
