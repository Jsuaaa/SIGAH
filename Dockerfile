# syntax=docker/dockerfile:1.7

# ==========================================
# Stage 1: Build frontend (Vite → client/dist)
# ==========================================
FROM node:22-alpine AS frontend-builder

# Install pnpm matching the version pinned in package.json → packageManager
RUN npm install -g pnpm@10.30.1

WORKDIR /app/client

# Copy manifest + lockfile first for better layer caching
COPY client/package.json client/pnpm-lock.yaml ./

# Install deps with the lockfile pinned (fails if drift detected)
RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY client/ ./

# Build → /app/client/dist
RUN pnpm build


# ==========================================
# Stage 2: Runtime (backend + built frontend)
# ==========================================
FROM node:22-alpine AS runtime

# Prisma on Alpine needs openssl + libc6-compat
RUN apk add --no-cache openssl libc6-compat

# Install pnpm
RUN npm install -g pnpm@10.30.1

# Keep same folder structure as the repo so server's
# path.join(__dirname, '../../client/dist') resolves correctly
WORKDIR /app/server

# Copy manifest + lockfile for cached install
COPY server/package.json server/pnpm-lock.yaml ./

# Install all deps (tsx is a devDependency but needed at runtime)
RUN pnpm install --frozen-lockfile

# Copy server source + prisma schema + migrations
COPY server/ ./

# Generate Prisma client (uses schema.prisma)
RUN pnpm exec prisma generate

# Copy built frontend from Stage 1 to the path the server expects
COPY --from=frontend-builder /app/client/dist /app/client/dist

# Entrypoint script (runs migrations, then starts server)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Backend default port
EXPOSE 3000

# Runtime env defaults (Coolify overrides these)
ENV NODE_ENV=production
ENV PORT=3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["pnpm", "start"]
