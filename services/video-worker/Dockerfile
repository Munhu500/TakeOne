# Build from the repo root:  docker build -f services/video-worker/Dockerfile -t takeone-worker .
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-inter fonts-freefont-ttf fonts-noto-core ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/providers packages/providers
COPY services/video-worker services/video-worker
RUN pnpm install --frozen-lockfile --filter @takeone/video-worker...
ENV NODE_ENV=production WORK_DIR=/tmp/takeone-work
WORKDIR /app/services/video-worker
CMD ["pnpm", "start"]
