# Storyhollow: one container, one volume for books, photos and audio.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000 \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning
COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/scripts/start.mjs ./scripts/start.mjs
EXPOSE 3000
# Not "npx next start": npx exits with an error when Railway stops the old
# version during an update, which Railway reports as a crash.
CMD ["node", "scripts/start.mjs"]
