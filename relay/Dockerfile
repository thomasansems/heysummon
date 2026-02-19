FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Production image
FROM node:22-alpine

WORKDIR /app

# Install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && \
    # better-sqlite3 needs native rebuild in Alpine
    npm rebuild better-sqlite3

# Copy built app
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite
RUN mkdir -p /app/data

# Environment
ENV NODE_ENV=production
ENV PORT=4000
ENV RELAY_DB_PATH=/app/data/relay.db

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -q --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
