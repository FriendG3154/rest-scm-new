# Stage 1: Install dependencies
FROM m.daocloud.io/docker.io/library/node:24-slim AS deps
WORKDIR /app

ARG UV_THREADPOOL_SIZE=2
ARG npm_config_jobs=2
ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV UV_THREADPOOL_SIZE=${UV_THREADPOOL_SIZE}
ENV npm_config_jobs=${npm_config_jobs}
ENV NODE_OPTIONS=${NODE_OPTIONS}

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources
RUN apt-get update -y && apt-get install -y openssl
RUN npm ci --include=optional
RUN set -eux; \
	OXIDE_VERSION="$(node -p "require('./node_modules/@tailwindcss/oxide/package.json').version")"; \
	ARCH="$(uname -m)"; \
	if [ "$ARCH" = "x86_64" ]; then PKG="@tailwindcss/oxide-linux-x64-gnu"; \
	elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then PKG="@tailwindcss/oxide-linux-arm64-gnu"; \
	else echo "Unsupported arch for tailwind oxide native package: $ARCH"; exit 1; fi; \
	npm i --no-save "${PKG}@${OXIDE_VERSION}"

# Stage 2: Build the application
FROM m.daocloud.io/docker.io/library/node:24-slim AS builder
WORKDIR /app

ARG UV_THREADPOOL_SIZE=2
ARG npm_config_jobs=2
ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV UV_THREADPOOL_SIZE=${UV_THREADPOOL_SIZE}
ENV npm_config_jobs=${npm_config_jobs}
ENV NODE_OPTIONS=${NODE_OPTIONS}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables must be present at build time
# https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables
ENV NEXT_PUBLIC_AES_KEY=''
ENV JWT_SECRET = 'rest-scm-jwt-secret-key-change-in-production-at-least-32-chars'
ENV AES_KEY="1234567890abcdef"
ENV NEXT_PUBLIC_AES_KEY="1234567890abcdef"
ENV NODE_ENV production
ENV FILE_STORAGE_DIR="/data/uploads"

ENV NEXT_TELEMETRY_DISABLED 1
ENV SKIP_ENV_VALIDATION 1

COPY prisma ./prisma
# If using Prisma, generate client before build
RUN npx prisma generate

RUN npm run build

# Stage 3: Production image, copy all the files and run next
FROM m.daocloud.io/docker.io/library/node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV NEXT_PUBLIC_AES_KEY=''
ENV JWT_SECRET = 'rest-scm-jwt-secret-key-change-in-production-at-least-32-chars'
ENV AES_KEY="1234567890abcdef"
ENV NEXT_PUBLIC_AES_KEY="1234567890abcdef"
ENV WX_APPID="wx9f21486823bc2c2f"
ENV WX_SECRET="ef740928a09ce739447b221748babb71"
ENV NODE_ENV production
ENV FILE_STORAGE_DIR="/data/uploads"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data

# Set up timezone
ENV TZ="Asia/Shanghai"
RUN  ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Install openssl for Prisma runtime
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
# Copy the standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
