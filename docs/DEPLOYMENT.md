# N-VOC System Deployment Guide

## Critical: Deploy Security Fixes via Docker Rebuild

The source code contains authorization and rate-limiting fixes that are **not active in running containers** until images are rebuilt. Any deployment must follow the full rebuild procedure below. Restarting containers without rebuilding will continue running the old, unpatched code.

---

## Architecture Overview

```
                       +-------------------+
    Browser :3000 ---> |  Nginx (frontend) |
                       |  static SPA +     |
                       |  /api/ proxy      |
                       +--------+----------+
                                |
                       +--------v----------+
                       |  Express (backend) |
                       |  :4000 /api/*      |
                       +--------+----------+
                                |
                       +--------v----------+
                       |  MySQL 8.4 (db)   |
                       |  :3306             |
                       +-------------------+
```

Three Docker containers on a shared bridge network (`voc-net`):

| Service    | Image              | Port | Purpose                              |
|------------|--------------------|------|--------------------------------------|
| `frontend` | `voc-frontend`     | 3000 | Nginx-served React SPA + API proxy   |
| `backend`  | `voc-backend`      | 4000 | Express/TypeScript REST API          |
| `db`       | `mysql:8.4`        | 3306 | MySQL database, persistent volume    |

---

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- At least 2 GB free RAM (MySQL alone needs ~512 MB)
- Ports 3000, 4000, 3306 available (configurable via `.env`)

---

## Environment Variables

Copy the template and fill in all `change_me` values before first deployment:

```bash
cp .env.example .env
```

### Required Variables (compose will refuse to start without these)

| Variable              | Description                                | Example                              |
|-----------------------|--------------------------------------------|--------------------------------------|
| `MYSQL_ROOT_PASSWORD` | MySQL root password                        | `$(openssl rand -hex 16)`            |
| `DB_PASSWORD`         | Application database user password         | `$(openssl rand -hex 16)`            |
| `JWT_SECRET`          | JWT signing key, minimum 16 characters     | `$(openssl rand -hex 32)`            |

### Optional Variables (have safe defaults)

| Variable              | Default                  | Description                                 |
|-----------------------|--------------------------|---------------------------------------------|
| `NODE_ENV`            | `production`             | Runtime mode                                |
| `DB_NAME`             | `voc_system`             | Database name                               |
| `DB_USER`             | `voc_app`                | Database application user                   |
| `DB_PORT`             | `3306`                   | Host port published for DB tooling          |
| `DB_CONNECTION_LIMIT` | `10`                     | MySQL connection pool size                  |
| `API_PORT`            | `4000`                   | Host port for direct backend access         |
| `CORS_ORIGIN`         | `http://localhost:3000`  | Allowed CORS origin                         |
| `JWT_EXPIRES_IN`      | `8h`                     | JWT token lifetime                          |
| `MAX_UPLOAD_BYTES`    | `10485760` (10 MB)       | Max file upload size                        |
| `VITE_API_BASE_URL`   | _(empty = relative /api)_| Frontend API base URL (build-time)          |
| `VITE_APP_NAME`       | `N-VOC Request System`   | Application title (build-time)              |
| `FRONTEND_PORT`       | `3000`                   | Host port for the SPA                       |
| `GEMINI_API_KEY`      | _(empty)_                | Optional: enables AI ticket triage          |

---

## Initial Deployment

### Step 1: Configure environment

```bash
cp .env.example .env

# Generate secure secrets
sed -i "s/change_me_root/$(openssl rand -hex 16)/" .env
sed -i "s/change_me_app/$(openssl rand -hex 16)/" .env
sed -i "s/change_me_to_a_long_random_secret_min_16/$(openssl rand -hex 32)/" .env
```

### Step 2: Build and start all services

```bash
docker compose up -d --build
```

This will:
1. Build the backend image (multi-stage: TypeScript compile, prune dev deps)
2. Build the frontend image (multi-stage: Vite build, copy to Nginx)
3. Start MySQL and wait for its healthcheck to pass
4. Start the backend (depends on healthy DB)
5. Start the frontend (depends on backend)

### Step 3: Verify services are healthy

```bash
# Check all containers are running
docker compose ps

# Check health status
docker inspect --format='{{.State.Health.Status}}' voc-db
docker inspect --format='{{.State.Health.Status}}' voc-backend
docker inspect --format='{{.State.Health.Status}}' voc-frontend
```

### Step 4: Verify the health endpoint

```bash
# Via Nginx proxy (production path)
curl -s http://localhost:3000/health | jq .
# Expected: {"status":"ok","db":"up"}

# Direct backend access
curl -s http://localhost:4000/health | jq .
# Expected: {"status":"ok","db":"up"}
```

---

## Database Initialization

Database schema and seed data are applied automatically on first startup from SQL files in `database/init/`:

| File                   | Purpose                                            |
|------------------------|----------------------------------------------------|
| `01_schema.sql`        | Core schema: users, tickets, comments, history     |
| `02_seed.sql`          | Demo data: users, categories, sample tickets       |
| `03_it_devices.sql`    | Device inventory tables, specifications, MAC addresses, device history |
| `04_mac_addresses.sql` | Additional MAC address data                        |

These scripts run **once** when the MySQL data volume is empty. To re-initialize:

```bash
# WARNING: This destroys all data
docker compose down -v          # remove containers AND volumes
docker compose up -d --build    # rebuild and start fresh
```

To run a migration against an existing database without destroying data:

```bash
docker exec -i voc-db mysql -u root -p"$MYSQL_ROOT_PASSWORD" voc_system < database/init/03_it_devices.sql
```

---

## Health Check Endpoints

### Backend: `GET /health` (no authentication required)

```bash
curl -s http://localhost:4000/health
```

| Response Code | Body                              | Meaning                    |
|---------------|-----------------------------------|----------------------------|
| `200`         | `{"status":"ok","db":"up"}`       | All systems operational    |
| `503`         | `{"status":"degraded","db":"down"}` | DB connection failed     |

### Frontend: `GET /` (Nginx)

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# Expected: 200
```

### Docker-level healthchecks

- **Backend**: Node.js fetch to `http://127.0.0.1:4000/health` every 15s
- **Frontend**: `wget` to `http://127.0.0.1:3000/` every 15s
- **Database**: `mysqladmin ping` every 10s

---

## Port Configuration

| Service   | Container Port | Host Port Variable | Default |
|-----------|----------------|--------------------|---------|
| Frontend  | 3000           | `FRONTEND_PORT`    | 3000    |
| Backend   | 4000           | `API_PORT`         | 4000    |
| Database  | 3306           | `DB_PORT`          | 3306    |

To use non-default ports:

```bash
FRONTEND_PORT=8080 API_PORT=8081 DB_PORT=3307 docker compose up -d --build
```

---

## Deploying Updates (Rolling Deployment)

### Standard update procedure

```bash
# 1. Pull latest source code
git pull origin main

# 2. Rebuild images with new source code (--no-cache ensures all layers are fresh)
docker compose build --no-cache

# 3. Rolling restart: backend first, then frontend
docker compose up -d --no-deps backend
docker compose up -d --no-deps frontend

# 4. Verify health
curl -s http://localhost:3000/health | jq .

# 5. Verify authorization is enforced (should return 401 for unauthenticated)
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/devices
# Expected: 401

# 6. Verify role-based access (should return 403 for requester on admin-only reports)
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"requester@example.com","password":"password"}' | jq -r '.token')

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/devices/reports/summary
# Expected: 403
```

### Deploying database migrations

If the update includes new SQL migration files:

```bash
# After rebuilding and before restarting the backend
docker exec -i voc-db mysql -u root -p"$MYSQL_ROOT_PASSWORD" voc_system < database/init/NEW_MIGRATION.sql

# Then restart backend
docker compose up -d --no-deps backend
```

### Zero-downtime considerations

The current single-host Docker Compose setup does not support true zero-downtime deployments. For production environments requiring zero downtime:

1. Deploy behind a load balancer (e.g., Nginx, Traefik, AWS ALB)
2. Use blue-green deployment: spin up new containers on different ports, health-check them, then swap traffic
3. Consider Docker Swarm or Kubernetes for orchestrated rolling updates

---

## Rollback Procedures

### Quick rollback (restore previous images)

```bash
# 1. Stop current containers
docker compose down

# 2. Checkout the previous known-good commit
git log --oneline -5   # identify the target commit
git checkout <commit-hash>

# 3. Rebuild and restart
docker compose up -d --build

# 4. Verify health
curl -s http://localhost:3000/health | jq .
```

### Database rollback

If a migration introduced breaking schema changes:

```bash
# 1. Stop the application
docker compose stop backend frontend

# 2. Restore from backup
docker exec -i voc-db mysql -u root -p"$MYSQL_ROOT_PASSWORD" voc_system < /path/to/backup.sql

# 3. Checkout previous code and rebuild
git checkout <previous-commit>
docker compose up -d --build
```

### Emergency: full volume restore

```bash
docker compose down
docker volume rm n-voc-system-service-portal_voc-db-data
# Restore volume from your backup tool/snapshot
docker compose up -d --build
```

---

## Backup Procedures

### Database backup (automated)

```bash
# Full dump
docker exec voc-db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction --routines --triggers \
  voc_system > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker exec voc-db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction voc_system | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Upload volume backup

```bash
docker cp voc-backend:/app/uploads ./uploads_backup_$(date +%Y%m%d)
```

### Crontab example

```cron
# Daily database backup at 2 AM
0 2 * * * cd /path/to/project && docker exec voc-db mysqldump -u root -p"$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2)" --single-transaction voc_system | gzip > /backups/voc_$(date +\%Y\%m\%d).sql.gz

# Weekly uploads backup
0 3 * * 0 docker cp voc-backend:/app/uploads /backups/uploads_$(date +\%Y\%m\%d)

# Retain 30 days of backups
0 4 * * * find /backups -name "voc_*.sql.gz" -mtime +30 -delete
```

---

## Monitoring Recommendations

### Log aggregation

```bash
# Follow all service logs
docker compose logs -f

# Follow specific service
docker compose logs -f backend

# Export logs for analysis
docker compose logs --no-color backend > backend.log 2>&1
```

### Key metrics to watch

| Metric                        | Threshold         | Action                          |
|-------------------------------|--------------------|---------------------------------|
| Backend health endpoint       | != 200             | Alert, check DB connectivity    |
| HTTP 429 (rate limit) count   | > 50/hour          | Investigate source IPs          |
| HTTP 401/403 count            | Sudden spike       | Possible attack, review logs    |
| Container restart count       | > 0                | Check `docker inspect` logs     |
| MySQL connection count        | > 80% of pool      | Increase `DB_CONNECTION_LIMIT`  |
| Disk usage (db volume)        | > 80%              | Expand storage, archive data    |
| Upload volume size            | > 5 GB             | Archive old attachments         |
| Response time (p95)           | > 2s               | Profile slow queries            |

### Rate limiter monitoring

The application returns `RateLimit-*` standard headers on rate-limited endpoints:

| Endpoint Pattern                    | Window   | Max Requests | Purpose                |
|-------------------------------------|----------|--------------|------------------------|
| `POST /api/auth/login`              | 15 min   | 10           | Brute-force prevention |
| `POST /api/ai/triage`              | 15 min   | 10           | External API cost control |
| `POST /api/devices/:id/assign`     | 15 min   | 30           | DoS prevention         |
| `POST /api/devices/:id/checkout`   | 15 min   | 30           | DoS prevention         |
| `POST /api/tickets`               | 15 min   | 30           | DoS prevention         |
| `POST /api/tickets/:id/comments`   | 15 min   | 50           | DoS prevention         |
| `POST /api/tickets/:id/attachments`| 15 min   | 30           | DoS prevention         |

A sustained 429 spike from a single IP may indicate an attack. A broad 429 spike across many IPs may indicate the limits are too restrictive for legitimate traffic.

### Recommended alert thresholds

```
# Health check failure
IF health_check != 200 FOR 3 consecutive checks (45s) THEN page oncall

# Rate limiter abuse
IF count(status=429) > 100 IN 15 minutes THEN alert security

# Error rate
IF count(status>=500) / count(all_requests) > 5% IN 5 minutes THEN page oncall

# Database connection exhaustion
IF active_connections > 8 (80% of default pool=10) THEN warn ops
```

### External monitoring

Configure an uptime monitor against:

```
GET http://<host>:3000/health
Expected: HTTP 200, body contains "ok"
Alert if: 3 consecutive failures within 5 minutes
```

---

## Troubleshooting

### Backend won't start

```bash
# Check logs
docker compose logs backend

# Common causes:
# 1. DB not ready - backend waits for db healthcheck
docker compose logs db

# 2. Missing environment variables
docker compose config  # validates .env against compose file

# 3. JWT_SECRET too short (zod-validated at boot, must be >= 16 chars)
echo ${JWT_SECRET} | wc -c
```

### Database connection refused

```bash
# Verify DB is healthy
docker exec voc-db mysqladmin -u root -p"$MYSQL_ROOT_PASSWORD" status

# Check if init scripts ran successfully
docker exec voc-db mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW TABLES" voc_system
```

### Frontend shows blank page

```bash
# Check Nginx logs
docker compose logs frontend

# Verify static files exist in the container
docker exec voc-frontend ls /usr/share/nginx/html/

# Verify API proxy works from inside the frontend container
docker exec voc-frontend wget -q -O- http://backend:4000/health
```

### Permission denied on uploads

```bash
# The backend runs as the `node` user (UID 1000)
docker exec voc-backend ls -la /app/uploads
docker exec voc-backend whoami  # expected: "node"
```

---

## Known Limitations

1. **Single-host only**: Docker Compose is designed for a single server. For HA, migrate to Docker Swarm or Kubernetes.
2. **Pivot table pagination**: Device report endpoints return full result sets without server-side pagination. Large inventories (1000+ devices) may experience slower responses.
3. **Device assignment response timing**: Assign/checkout endpoints perform multiple database operations in a transaction. Under high concurrency, response times may increase.
4. **Build-time frontend config**: `VITE_API_BASE_URL` and `VITE_APP_NAME` are baked into the frontend image at build time. Changing them requires a rebuild.
5. **No HTTPS termination**: Nginx serves plain HTTP on port 3000. Deploy behind a TLS-terminating proxy (Traefik, Caddy, AWS ALB) for production.
6. **Init scripts are one-shot**: Database migrations in `database/init/` only run when the MySQL data volume is empty. Schema changes to an existing database must be applied manually.
