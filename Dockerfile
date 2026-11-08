# Replaces the Heroku Node buildpack Dokku used (`npm start` -> `tsx .`).
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["node_modules/.bin/tsx", "."]
