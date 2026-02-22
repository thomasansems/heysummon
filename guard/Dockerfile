FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
RUN addgroup -g 1001 guard && adduser -u 1001 -G guard -s /bin/sh -D guard
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER guard
EXPOSE 3457
CMD ["node", "dist/index.js"]
