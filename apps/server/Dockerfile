FROM --platform=linux/amd64 oven/bun:1.3.5 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json ./apps/server/
RUN mkdir -p packages
RUN bun install

FROM --platform=linux/amd64 oven/bun:1.3.5-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=deps /app/node_modules ./node_modules
COPY apps/server/src ./apps/server/src
COPY apps/server/tsconfig.json ./apps/server/tsconfig.json
COPY apps/server/package.json ./apps/server/package.json
WORKDIR /app/apps/server
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:8080/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
CMD ["bun", "run", "src/index.ts"]
