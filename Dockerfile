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
VOLUME /data
EXPOSE 3000
CMD ["npx", "next", "start"]
