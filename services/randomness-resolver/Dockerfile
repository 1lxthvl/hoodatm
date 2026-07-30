FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
WORKDIR /app
RUN groupadd --system resolver && useradd --system --gid resolver --home-dir /app resolver
COPY --from=build --chown=resolver:resolver /app/package.json /app/package-lock.json ./
COPY --from=build --chown=resolver:resolver /app/node_modules ./node_modules
COPY --from=build --chown=resolver:resolver /app/dist ./dist
USER resolver
EXPOSE 8787
STOPSIGNAL SIGTERM
CMD ["node", "dist/src/main.js"]
