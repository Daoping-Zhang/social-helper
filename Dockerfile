# syntax=docker/dockerfile:1

# ---- 1. build frontend ----
FROM node:24-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build

# ---- 2. runtime ----
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY --from=web /app/server/public ./server/public

RUN mkdir -p /app/data
ENV DATA_DIR=/app/data
ENV PORT=3000

EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.js"]
