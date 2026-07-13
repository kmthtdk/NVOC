# N-VOC System Production Checklist

Use this checklist before every production deployment. Each section must be completed in order.

---

## 1. Pre-Deployment Verification

### Source Code

- [ ] All changes are committed and pushed to the deployment branch
- [ ] Code review completed for all changes in the deployment
- [ ] No `console.log` or debug statements in production code
- [ ] No hardcoded credentials, API keys, or passwords in source
- [ ] TypeScript compiles without errors: `cd backend && npm run build`
- [ ] Frontend builds without errors: `npm run build`

### Environment

- [ ] `.env` file exists with all required variables populated
- [ ] `MYSQL_ROOT_PASSWORD` is not a default/example value
- [ ] `DB_PASSWORD` is not a default/example value
- [ ] `JWT_SECRET` is at least 16 characters and randomly generated
- [ ] `CORS_ORIGIN` matches the actual deployment URL
- [ ] `NODE_ENV` is set to `production`

### Docker

- [ ] Docker Engine 24+ installed
- [ ] Docker Compose v2 installed
- [ ] Sufficient disk space (at least 2 GB free)
- [ ] Required ports are available (3000, 4000, 3306 or custom)
- [ ] Previous images are tagged for rollback reference

---

## 2. Security Checklist

### Authentication and Authorization

- [ ] All API endpoints (except `/health`) require JWT authentication
- [ ] Report endpoints enforce `requireRole('it_support', 'admin')`
- [ ] Device mutation endpoints (create, update, assign, checkout) enforce `requireRole('it_support', 'admin')`
- [ ] Device deletion enforces `requireRole('admin')`
- [ ] Ticket status/assignment changes enforce `requireRole('it_support', 'admin')`
- [ ] Ticket deletion enforces `requireRole('admin')`
- [ ] JWT tokens expire after the configured `JWT_EXPIRES_IN` (default: 8h)

**Verification commands** (run after deployment):

```bash
# Should return 401 (no token)
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/devices
# Expected: 401

# Should return 401 (no token)
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/tickets
# Expected: 401

# Login as requester and attempt admin-only report (should return 403)
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"requester@example.com","password":"password"}' | jq -r '.token')

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/devices/reports/summary
# Expected: 403

# Login as admin and verify reports work (should return 200)
ADMIN_TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password"}' | jq -r '.token')

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/devices/reports/summary
# Expected: 200
```

### Rate Limiting

- [ ] Login endpoint rate-limited to 10 requests per 15 minutes per IP
- [ ] AI triage endpoint rate-limited to 10 requests per 15 minutes per IP
- [ ] Device mutation endpoints rate-limited to 30 requests per 15 minutes per IP
- [ ] Ticket creation rate-limited to 30 requests per 15 minutes per IP
- [ ] Comment submission rate-limited to 50 requests per 15 minutes per IP
- [ ] Attachment upload rate-limited to 30 requests per 15 minutes per IP
- [ ] Rate limit headers are returned (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`)

**Verification command:**

```bash
# Check rate limit headers on login endpoint
curl -s -D - -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"wrong"}' 2>&1 | grep -i ratelimit
# Should show RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset headers
```

### Secrets Management

- [ ] No secrets committed to git (check with `git log --all -p | grep -i "password\|secret\|api_key"`)
- [ ] `.env` file is in `.gitignore`
- [ ] `JWT_SECRET` was generated with `openssl rand -hex 32` (not manually typed)
- [ ] Database passwords are unique and not reused from other systems
- [ ] `GEMINI_API_KEY` is either empty (feature disabled) or a valid, scoped key

### Input Validation

- [ ] All request bodies validated with Zod schemas before processing
- [ ] SQL queries use parameterized statements (no string concatenation)
- [ ] File uploads limited to 10 MB (`MAX_UPLOAD_BYTES`)
- [ ] Nginx `client_max_body_size` set to 12 MB (accommodates overhead)
- [ ] MAC addresses validated against regex `^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$`

---

## 3. Performance Validation

### Response Times

- [ ] Health endpoint responds in < 500ms
- [ ] Device list (paginated) responds in < 1s with default page size
- [ ] Ticket list (paginated) responds in < 1s with default page size

**Verification commands:**

```bash
# Health endpoint latency
curl -s -o /dev/null -w "Health: %{time_total}s\n" http://localhost:4000/health

# Device list latency (authenticated)
curl -s -o /dev/null -w "Devices: %{time_total}s\n" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/devices

# Ticket list latency (authenticated)
curl -s -o /dev/null -w "Tickets: %{time_total}s\n" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/tickets
```

### Resource Usage

- [ ] MySQL container memory usage < 512 MB under normal load
- [ ] Backend container memory usage < 256 MB
- [ ] Database connection pool size is appropriate (`DB_CONNECTION_LIMIT`, default 10)

```bash
docker stats --no-stream voc-db voc-backend voc-frontend
```

### Database Indexes

- [ ] Full-text index on `devices(code, model, serial_number)` for search
- [ ] Full-text index on `devices(cpu, gpu)` for spec search
- [ ] Index on `device_history(device_id)` for history queries
- [ ] Index on `device_history(created_at)` for time-range reports

---

## 4. Data Integrity Checks

### Database Schema

```bash
# Verify all expected tables exist
docker exec voc-db mysql -u root -p"$MYSQL_ROOT_PASSWORD" voc_system -e "
  SELECT TABLE_NAME, TABLE_ROWS
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = 'voc_system'
  ORDER BY TABLE_NAME;
"
```

Expected tables:
- [ ] `categories`
- [ ] `comments`
- [ ] `device_history`
- [ ] `device_sequence`
- [ ] `devices`
- [ ] `mac_addresses`
- [ ] `subcategories`
- [ ] `request_types`
- [ ] `ticket_device_links`
- [ ] `ticket_history`
- [ ] `tickets`
- [ ] `users`
- [ ] `attachments`

### Foreign Key Integrity

```bash
# Check for orphaned records
docker exec voc-db mysql -u root -p"$MYSQL_ROOT_PASSWORD" voc_system -e "
  SELECT 'orphan_comments' AS check_name, COUNT(*) AS count
  FROM comments c LEFT JOIN tickets t ON c.ticket_id = t.id WHERE t.id IS NULL
  UNION ALL
  SELECT 'orphan_device_links', COUNT(*)
  FROM ticket_device_links tdl LEFT JOIN tickets t ON tdl.ticket_id = t.id WHERE t.id IS NULL
  UNION ALL
  SELECT 'orphan_mac_addresses', COUNT(*)
  FROM mac_addresses m LEFT JOIN devices d ON m.device_id = d.id WHERE d.id IS NULL;
"
# All counts should be 0
```

### Unique Constraints

- [ ] Device codes are unique (`uq_devices_code`)
- [ ] Device serial numbers are unique (`uq_devices_serial`)
- [ ] Active MAC addresses are unique (`uq_mac_active`)
- [ ] Ticket-device links are unique per pair (`uq_ticket_device`)

---

## 5. Monitoring Setup

### Health Monitoring

- [ ] External uptime monitor configured for `GET http://<host>:3000/health`
- [ ] Alert configured for 3 consecutive health check failures
- [ ] Alert escalation path documented

### Log Collection

- [ ] Docker logs are being collected (journald, syslog, or log driver)
- [ ] Log retention policy configured (minimum 30 days)
- [ ] Log rotation configured to prevent disk exhaustion

```bash
# Verify logs are accessible
docker compose logs --tail=10 backend
docker compose logs --tail=10 frontend
docker compose logs --tail=10 db
```

### Alerting

- [ ] Alert on container restarts (`docker events --filter event=restart`)
- [ ] Alert on 429 response spike (> 100 per 15 minutes)
- [ ] Alert on 5xx error rate (> 5% of requests over 5 minutes)
- [ ] Alert on disk usage > 80% on host and volumes
- [ ] Alert on MySQL connection count > 80% of pool size

---

## 6. Backup Procedures

### Database Backups

- [ ] Automated daily backup configured (see DEPLOYMENT.md for crontab example)
- [ ] Backup destination has sufficient storage (minimum 30 days retention)
- [ ] Backup restoration tested within the last 30 days

```bash
# Manual backup verification
docker exec voc-db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction voc_system | gzip > /tmp/test_backup.sql.gz

# Verify backup is valid (non-zero size and contains table definitions)
ls -lh /tmp/test_backup.sql.gz
zcat /tmp/test_backup.sql.gz | head -20
```

### Upload Backups

- [ ] Upload volume (`voc-uploads`) backed up regularly
- [ ] Backup includes all attachment files

```bash
docker cp voc-backend:/app/uploads /tmp/uploads_check
ls -la /tmp/uploads_check/
```

---

## 7. Post-Deployment Smoke Tests

Run these tests immediately after every deployment:

### Infrastructure

```bash
# 1. All containers running
docker compose ps
# All three services should show "Up" with healthy status

# 2. Health endpoint
curl -s http://localhost:3000/health | jq .
# Expected: {"status":"ok","db":"up"}

# 3. Frontend loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# Expected: 200
```

### Authentication Flow

```bash
# 4. Login works
curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password"}' | jq '.token | length > 0'
# Expected: true

# 5. Token validation works
ADMIN_TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password"}' | jq -r '.token')

curl -s http://localhost:4000/api/auth/validate \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .user.role
# Expected: "admin"
```

### Core CRUD Operations

```bash
# 6. List devices
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/devices | jq '.pagination.total'
# Expected: a number >= 0

# 7. List tickets
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/tickets | jq '.total'
# Expected: a number >= 0

# 8. List categories
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/categories | jq 'length'
# Expected: a number > 0
```

### Report Endpoints

```bash
# 9. Device summary report
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/devices/reports/summary
# Expected: 200

# 10. Ticket stats summary
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/tickets/stats/summary
# Expected: 200
```

### Authorization Enforcement

```bash
# 11. Unauthenticated access blocked
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/devices
# Expected: 401

# 12. Requester cannot access admin reports
REQ_TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"requester@example.com","password":"password"}' | jq -r '.token')

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $REQ_TOKEN" \
  http://localhost:4000/api/devices/reports/summary
# Expected: 403

# 13. Requester cannot delete tickets
curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  -H "Authorization: Bearer $REQ_TOKEN" \
  http://localhost:4000/api/tickets/1
# Expected: 403

# 14. Requester cannot create devices
curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $REQ_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"deviceType":"laptop","model":"Test","serialNumber":"TEST-001"}' \
  http://localhost:4000/api/devices
# Expected: 403
```

---

## 8. Incident Response Procedures

### Severity Levels

| Level | Definition | Response Time | Examples |
|-------|-----------|---------------|----------|
| P1 - Critical | System down, data loss risk | 15 minutes | Health check failing, DB unreachable |
| P2 - High | Major feature broken | 1 hour | Authentication failing, reports returning errors |
| P3 - Medium | Minor feature issue | 4 hours | One report returning wrong data, slow responses |
| P4 - Low | Cosmetic or minor | Next business day | UI alignment, typo in error message |

### P1 Response Procedure

```bash
# 1. Confirm the issue
docker compose ps
curl -s http://localhost:3000/health | jq .

# 2. Check logs for the root cause
docker compose logs --tail=100 backend
docker compose logs --tail=100 db

# 3. If backend is crash-looping, restart it
docker compose restart backend

# 4. If DB is down, check disk space and restart
df -h
docker compose restart db

# 5. If all else fails, full rollback
docker compose down
git checkout <last-known-good-commit>
docker compose up -d --build

# 6. Verify recovery
curl -s http://localhost:3000/health | jq .
```

### P2 Response Procedure

```bash
# 1. Identify which component is failing
docker compose logs --tail=50 backend | grep -i error

# 2. Check if it's a rate-limiting issue
docker compose logs backend | grep -c "429"

# 3. Check database connectivity
docker exec voc-db mysqladmin -u root -p"$MYSQL_ROOT_PASSWORD" status

# 4. Restart the affected service
docker compose restart backend  # or frontend

# 5. If issue persists, escalate to P1 procedure
```

### Security Incident

If unauthorized access or data breach is suspected:

1. **Immediately** rotate all secrets:
   ```bash
   # Generate new secrets
   openssl rand -hex 32  # new JWT_SECRET
   openssl rand -hex 16  # new DB_PASSWORD
   openssl rand -hex 16  # new MYSQL_ROOT_PASSWORD

   # Update .env with new values
   # Rebuild and restart
   docker compose down
   docker compose up -d --build
   ```

2. **Review** access logs for the scope of the breach:
   ```bash
   docker compose logs backend | grep -E "(401|403|POST /api/auth)" > /tmp/auth_audit.log
   ```

3. **Notify** stakeholders per organizational incident response policy

4. **Document** the incident: timeline, impact, root cause, remediation steps

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Reviewer | | | |
| Operations | | | |
