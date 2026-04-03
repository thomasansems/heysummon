# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
RUN pnpm exec prisma generate
# pnpm nests the generated client inside .pnpm — copy it to the top-level path
# so the runner stage can pick it up with a simple COPY
RUN if [ ! -d node_modules/.prisma/client ]; then \
      mkdir -p node_modules/.prisma && \
      cp -rL "$(find node_modules/.pnpm -path '*/.prisma/client' -type d | head -1)" node_modules/.prisma/client; \
    fi

# Stage 2: Build
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/prisma ./prisma
# Install prisma CLI for database migrations (db-migrate service in docker-compose.yml)
COPY --from=deps /app/node_modules/prisma/package.json /tmp/prisma-pkg.json
RUN npm install -g "prisma@$(node -e "console.log(require('/tmp/prisma-pkg.json').version)")" && rm /tmp/prisma-pkg.json
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
