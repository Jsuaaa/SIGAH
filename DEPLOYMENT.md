# SIGAH - Deployment Plan (Dev & Prod on Single VPS)

## Architecture Overview

```
VPS
├── nginx (reverse proxy + SSL)
│   ├── api.sigah.com        → prod (port 3000)
│   └── dev.api.sigah.com    → dev  (port 3001)
│
├── sigah-prod/
│   ├── app       (Node.js container)
│   └── postgres  (port 5432, dedicated volume)
│
└── sigah-dev/
    ├── app       (Node.js container)
    └── postgres  (port 5433, dedicated volume)
```

Both environments are fully isolated: separate databases, separate volumes, separate secrets. Nginx routes traffic by subdomain.

---

## Project File Structure

```
sigah-backend/
├── .env.development
├── .env.production
├── Dockerfile
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── nginx/
    └── default.conf
```

---

## 1. Dockerfile (shared by both environments)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY db ./db
COPY src ./src

EXPOSE 3000
CMD ["node", "src/index.js"]
```

---

## 2. Docker Compose — Production

```yaml
# docker-compose.prod.yml
services:
  app:
    build: .
    container_name: sigah-prod-app
    env_file: .env.production
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    restart: always

  db:
    image: postgres:16-alpine
    container_name: sigah-prod-db
    environment:
      POSTGRES_USER: sigah_prod
      POSTGRES_PASSWORD: ${PROD_DB_PASSWORD}
      POSTGRES_DB: sigah_production
    volumes:
      - sigah_prod_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sigah_prod"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: always

volumes:
  sigah_prod_data:
```

> **Note**: No `ports` exposed for `db` to the host. Only the app container communicates with Postgres internally via Docker network.

---

## 3. Docker Compose — Development

```yaml
# docker-compose.dev.yml
services:
  app:
    build: .
    container_name: sigah-dev-app
    env_file: .env.development
    ports:
      - "3001:3000"
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    container_name: sigah-dev-db
    environment:
      POSTGRES_USER: sigah_dev
      POSTGRES_PASSWORD: ${DEV_DB_PASSWORD}
      POSTGRES_DB: sigah_development
    volumes:
      - sigah_dev_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sigah_dev"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  sigah_dev_data:
```

> **Note**: Dev exposes Postgres on port 5433 so developers can connect with GUI tools (pgAdmin, DBeaver) for debugging. Prod does not expose its database port.

---

## 4. Environment Files

### .env.production

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://sigah_prod:<PROD_DB_PASSWORD>@db:5432/sigah_production
JWT_SECRET=<generate-a-64-char-random-string>
PROD_DB_PASSWORD=<generate-a-secure-password>
```

### .env.development

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://sigah_dev:<DEV_DB_PASSWORD>@db:5432/sigah_development
JWT_SECRET=dev-secret-not-for-production
DEV_DB_PASSWORD=dev_password_123
```

> **Important**: Never commit `.env.production` to git. Add both `.env.production` and `.env.development` to `.gitignore`. Use `.env.example` to document required variables.

### .env.example

```bash
NODE_ENV=
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@db:5432/<database>
JWT_SECRET=
```

---

## 5. Nginx Reverse Proxy

### nginx/default.conf

```nginx
server {
    listen 80;
    server_name api.sigah.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name dev.api.sigah.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 6. Isolation Summary

| Resource | Development | Production |
|----------|-------------|------------|
| Database name | `sigah_development` | `sigah_production` |
| Database user | `sigah_dev` | `sigah_prod` |
| Database port (host) | `5433` | Not exposed |
| Data volume | `sigah_dev_data` | `sigah_prod_data` |
| App port (host) | `3001` | `3000` |
| Subdomain | `dev.api.sigah.com` | `api.sigah.com` |
| JWT secret | Shared dev key | Unique secure key |
| Restart policy | `unless-stopped` | `always` |
| Migrations | `pnpm db:migrate` (custom runner) | `pnpm db:migrate` (custom runner) |
| Seed data | Yes (demo data) | No |

---

## 7. VPS Initial Setup

Run these commands once on a fresh VPS (Ubuntu 22.04+ recommended):

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. Install Docker Compose (included with Docker Engine 24+)
docker compose version

# 4. Install Nginx
sudo apt install nginx -y

# 5. Clone the project
mkdir -p /opt/sigah
cd /opt/sigah
git clone <repo-url> .

# 6. Create environment files
cp .env.example .env.development
cp .env.example .env.production
# Edit both files with proper values

# 7. Copy Nginx config
sudo cp nginx/default.conf /etc/nginx/sites-available/sigah
sudo ln -s /etc/nginx/sites-available/sigah /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 8. Install SSL with Certbot
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.sigah.com -d dev.api.sigah.com
```

---

## 8. Day-to-Day Commands

### Start / Rebuild

```bash
# Production
docker compose -f docker-compose.prod.yml up -d --build

# Development
docker compose -f docker-compose.dev.yml up -d --build
```

### Run Migrations

The custom runner (`server/src/db/migrate.ts`) applies any pending
`db/migrations/*.sql` and **always reloads** every `db/procedures/**/*.sql`
(idempotent `CREATE OR REPLACE`).

```bash
# Production — apply pending migrations + reload procedures
docker compose -f docker-compose.prod.yml exec app pnpm run db:migrate

# Development — same command works in dev
docker compose -f docker-compose.dev.yml exec app pnpm run db:migrate
```

### Seed Database (dev only)

```bash
docker compose -f docker-compose.dev.yml exec app pnpm run db:seed
```

### View Logs

```bash
# Follow app logs
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.dev.yml logs -f app

# Follow all service logs
docker compose -f docker-compose.prod.yml logs -f
```

### Stop Services

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.dev.yml down
```

### Check Status

```bash
docker ps
```

---

## 9. Deploy Flow

```
Developer local machine
    │
    ├── git push origin main          (production branch)
    └── git push origin develop       (development branch)
            │
            ▼
        VPS (/opt/sigah)
            │
            ├── git pull
            │
            ├── Deploy to DEV first:
            │   docker compose -f docker-compose.dev.yml up -d --build
            │   docker compose -f docker-compose.dev.yml exec app pnpm run db:migrate
            │   → Test on dev.api.sigah.com
            │
            └── If DEV passes, deploy to PROD:
                docker compose -f docker-compose.prod.yml up -d --build
                docker compose -f docker-compose.prod.yml exec app pnpm run db:migrate
                → Verify on api.sigah.com
```

### Git Branch Strategy

| Branch | Environment | Deploy trigger |
|--------|-------------|----------------|
| `develop` | Development | Push to develop |
| `main` | Production | Merge develop → main |

---

## 10. Backup Strategy (Production)

### Automated Daily Backup via Cron

```bash
# Add to crontab: crontab -e
0 3 * * * /opt/sigah/scripts/backup.sh
```

### scripts/backup.sh

```bash
#!/bin/bash
BACKUP_DIR="/opt/sigah/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Dump production database
docker compose -f /opt/sigah/docker-compose.prod.yml exec -T db \
  pg_dump -U sigah_prod sigah_production | gzip > "$BACKUP_DIR/prod_$TIMESTAMP.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "prod_*.sql.gz" -mtime +7 -delete

echo "Backup completed: prod_$TIMESTAMP.sql.gz"
```

### Restore from Backup

```bash
gunzip -c backups/prod_20260412_030000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db \
  psql -U sigah_prod sigah_production
```

---

## 11. Minimum VPS Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 2 GB | 4 GB |
| CPU | 1 vCPU | 2 vCPU |
| Disk | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

For a 2 GB VPS, add memory limits to Docker Compose services:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 512M
  db:
    deploy:
      resources:
        limits:
          memory: 512M
```

---

## 12. Security Checklist

- [ ] `.env.production` not committed to git
- [ ] Production database port not exposed to host
- [ ] SSL/TLS enabled via Certbot for both subdomains
- [ ] Firewall allows only ports 80, 443, and 22 (SSH)
- [ ] SSH key authentication enabled, password auth disabled
- [ ] Docker containers run as non-root user
- [ ] Production JWT_SECRET is a cryptographically random 64+ character string
- [ ] Daily database backups configured and tested
- [ ] Nginx rate limiting configured for auth endpoints
