FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
COPY test ./test
COPY migrations ./migrations
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system indexer && useradd --system --gid indexer --home-dir /app indexer
COPY --from=build --chown=indexer:indexer /app/package.json /app/package-lock.json ./
COPY --from=build --chown=indexer:indexer /app/node_modules ./node_modules
COPY --from=build --chown=indexer:indexer /app/dist ./dist
COPY --from=build --chown=indexer:indexer /app/migrations ./migrations
USER indexer
EXPOSE 9460
STOPSIGNAL SIGTERM
CMD ["node", "dist/src/main.js"]
