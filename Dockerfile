# syntax=docker/dockerfile:1.7

# ==========================================
# Stage 1: Build frontend (Vite → client/dist)
# ==========================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/client

# Copy package files first for better layer caching
COPY client/package*.json ./

# Install deps (includes dev deps needed for Vite build)
RUN npm ci

# Copy frontend source
COPY client/ ./

# Build frontend → /app/client/dist
RUN npm run build


# ==========================================
# Stage 2: Runtime (backend + built frontend)
# ==========================================
FROM node:22-alpine AS runtime

# Prisma on Alpine needs openssl + libc6-compat
RUN apk add --no-cache openssl libc6-compat

# Keep same folder structure as the repo so server's
# path.join(__dirname, '../../client/dist') resolves correctly
WORKDIR /app/server

# Copy server package files (layer-cached install)
COPY server/package*.json ./

# Install all deps (tsx is a devDependency but needed at runtime)
RUN npm ci

# Copy server source + prisma schema + migrations
COPY server/ ./

# Generate Prisma client (uses schema.prisma)
RUN npx prisma generate

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
CMD ["npm", "run", "start"]
