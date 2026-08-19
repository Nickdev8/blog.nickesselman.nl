# syntax=docker/dockerfile:1.7

FROM node:20-bookworm AS builder
WORKDIR /work
COPY app/package*.json app/.npmrc ./
RUN npm ci --include=dev --no-audit --no-fund
COPY app/ ./
RUN npm run build
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:20-bookworm AS runtime
WORKDIR /app
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/*
COPY --from=builder /work/node_modules ./node_modules
COPY --from=builder /work/build ./build
COPY --from=builder /work/scripts ./scripts
COPY app/src/posts ./src/posts
COPY app/src/translations ./src/translations
COPY app/static ./static
RUN mkdir -p /app/data
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", "scripts/run-with-translations.mjs", "build/index.js"]
