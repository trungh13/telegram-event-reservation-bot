# Operations Guide

Guide for deploying, monitoring, and maintaining the Event Booking System in production.

---

## Deployment

### Prerequisites

- Docker and Docker Compose
- PostgreSQL 15+ (or use container)
- Valid Telegram bot token
- Server with 2GB+ RAM, 20GB disk

### Docker Deployment

#### Production Build

```bash
# Build image
docker build -t booking-system:v1.0.0 .

# Tag for registry
docker tag booking-system:v1.0.0 your-registry/booking-system:v1.0.0

# Push to registry
docker push your-registry/booking-system:v1.0.0
```

#### Run Container

```bash
docker run -d \
  --name booking-system \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://admin:password@postgres:5432/emerald?schema=public" \
  -e TELEGRAM_BOT_TOKEN="your_token" \
  -e TELEGRAM_BOT_NAME="your_bot_name" \
  -e ENV="production" \
  your-registry/booking-system:v1.0.0
```

### Docker Compose Production

**docker-compose.prod.yml**:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: booking-db
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: emerald
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - booking

  app:
    image: booking-system:latest
    container_name: booking-app
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "postgresql://admin:${DB_PASSWORD}@postgres:5432/emerald?schema=public"
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_BOT_NAME: ${TELEGRAM_BOT_NAME}
      ENV: production
    depends_on:
      - postgres
    restart: unless-stopped
    networks:
      - booking
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  postgres_data:

networks:
  booking:
    driver: bridge
```

**Deploy**:
```bash
# Create .env.prod
cp .env.example .env.prod
# Edit with production values

# Start services
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f app
```

---

### Database Migration in Production

```bash
# Run migrations before starting app
docker-compose exec postgres psql -U admin -d emerald -f /migrations/latest.sql

# Or using Prisma
docker-compose exec app pnpm prisma migrate deploy

# Verify
docker-compose exec postgres psql -U admin -d emerald -c "SELECT * FROM public.schema_migrations;"
```

---

## Environment Variables

### Required (Production)

```env
# Database
DATABASE_URL="postgresql://admin:strong_password@postgres:5432/emerald?schema=public"

# Telegram
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
TELEGRAM_BOT_NAME="my_event_bot"

# Environment
ENV="production"
```

### Optional

```env
# Node
NODE_ENV="production"

# Database (if not in URL)
POSTGRES_USER="admin"
POSTGRES_PASSWORD="strong_password"
POSTGRES_DB="emerald"

# Logging
LOG_LEVEL="info"  # debug, info, warn, error

# Server
PORT=3000
```

### Security Best Practices

- ✅ Never commit secrets to git
- ✅ Use `.env.prod` (add to `.gitignore`)
- ✅ Use secrets manager (AWS Secrets, HashiCorp Vault, 1Password)
- ✅ Rotate API keys quarterly
- ✅ Use strong database passwords (20+ characters, mixed case, symbols)
- ✅ Enable SSL for database connections
- ✅ Limit bot permissions in Telegram

---

## Monitoring

### Health Checks

```bash
# Health endpoint
curl http://localhost:3000/health

# Expected response
{ "status": "ok" }
```

### Log Monitoring

```bash
# Docker logs
docker-compose logs -f app

# Docker logs with timestamps
docker-compose logs -f --timestamps app

# Last 100 lines
docker-compose logs --tail 100 app

# Specific time range
docker-compose logs --since 1h app
```

### Key Metrics to Monitor

1. **Bot Responsiveness**
   - Response time to commands
   - Webhook request latency
   - Failed Telegram API calls

2. **Database**
   - Connection count
   - Query performance
   - Transaction rate
   - Replication lag (if applicable)

3. **Server**
   - CPU usage
   - Memory usage
   - Disk space
   - Network throughput

### Example Monitoring Setup (Prometheus)

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'booking-system'
    static_configs:
      - targets: ['localhost:3000']
```

---

## Backups

### Database Backup

#### Manual Backup

```bash
# Create backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Or with Docker
docker-compose exec postgres pg_dump -U admin emerald > backup-$(date +%Y%m%d).sql

# Verify backup
du -h backup-*.sql
file backup-*.sql
```

#### Automated Backups

```bash
#!/bin/bash
# backup.sh - Daily backup script

BACKUP_DIR="/backups/postgresql"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/emerald-$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

# Backup
pg_dump $DATABASE_URL > "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /usr/local/bin/backup.sh >> /var/log/pg_backups.log 2>&1
```

### Restore from Backup

```bash
# Stop application
docker-compose down

# Restore database
psql $DATABASE_URL < backup-20260123.sql

# Or with Docker
docker-compose exec postgres psql -U admin emerald < backup-20260123.sql

# Restart
docker-compose up -d

# Verify
curl http://localhost:3000/health
```

### Backup Storage

- **Local**: Store on separate disk
- **Cloud**: S3, Azure Blob, Google Cloud Storage
- **Frequency**: Daily (keep 30 days), Weekly (keep 3 months)
- **Encryption**: Encrypt backups at rest

---

## Database Maintenance

### Regular Maintenance

```bash
# Connect to database
psql $DATABASE_URL

# Vacuum (reclaim space)
VACUUM ANALYZE;

# Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname != 'pg_catalog'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Data Archival (Future)

As data grows, archive old records:

```sql
-- Archive instances > 1 year old
INSERT INTO event_instances_archive
SELECT * FROM event_instances
WHERE "createdAt" < NOW() - INTERVAL '1 year';

DELETE FROM event_instances
WHERE "createdAt" < NOW() - INTERVAL '1 year';

-- Similar for participation logs
INSERT INTO participation_log_archive
SELECT * FROM event_participation_log
WHERE "createdAt" < NOW() - INTERVAL '2 years';

DELETE FROM event_participation_log
WHERE "createdAt" < NOW() - INTERVAL '2 years';

-- Vacuum to reclaim space
VACUUM ANALYZE;
```

### Connection Pool Management

Use **pgBouncer** for connection pooling:

```ini
# pgbouncer.ini
[databases]
emerald = host=postgres port=5432 dbname=emerald

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

---

## Scaling

### Vertical Scaling

Increase server resources:
- CPU: 2 core → 4 core
- RAM: 2GB → 4GB, 8GB
- Disk: 20GB → 100GB, 500GB

### Horizontal Scaling (Future)

```
Load Balancer (nginx)
  ↓
[Bot Instance 1]
[Bot Instance 2]
[Bot Instance 3]
  ↓
Shared PostgreSQL Database
```

**Considerations**:
- Single bot instance per Telegram token
- Shared database for all instances
- Use queue system (RabbitMQ, Redis) for async tasks
- Coordinate cron jobs across instances

---

## Incident Response

### Bot Offline

**Diagnosis**:
```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs -f app

# Test health endpoint
curl http://localhost:3000/health
```

**Recovery**:
```bash
# Restart bot
docker-compose restart app

# If database issue, restart database too
docker-compose restart postgres app

# Full restart
docker-compose down
docker-compose up -d
```

### Database Locked

**Diagnosis**:
```sql
-- Find long-running queries
SELECT
  pid,
  usename,
  application_name,
  state,
  query_start,
  state_change
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
```

**Recovery**:
```sql
-- Kill specific query
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = 12345;

-- Kill all non-system connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE usename != 'postgres'
  AND application_name != 'pgAdmin4';
```

### High Memory Usage

**Diagnosis**:
```bash
# Check process memory
docker stats

# Check database size
psql $DATABASE_URL -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
  FROM pg_tables
  ORDER BY pg_total_relation_size DESC
  LIMIT 10;
"
```

**Recovery**:
- Archive old data
- Increase container memory limit
- Vacuum database
- Create indexes on frequently queried columns

### API Rate Limiting

Telegram API has rate limits:
- ~30 messages per second per bot
- ~1 message per second per group

**Solutions**:
- Queue outbound messages
- Batch operations
- Use message editing instead of new messages
- Implement exponential backoff

---

## Updates

### Rolling Update

```bash
# Build new version
docker build -t booking-system:v1.0.1 .

# Stop app (database stays up)
docker-compose stop app

# Update container
docker-compose up -d app

# Verify
curl http://localhost:3000/health

# Check logs
docker-compose logs -f app
```

### Database Migration During Update

```bash
# During deployment
docker-compose down

# Run migrations
pnpm prisma migrate deploy

# Start with new code
docker-compose up -d
```

### Rollback Procedure

```bash
# If new version has issues
docker-compose stop app

# Restore previous backup (if data corruption)
# psql $DATABASE_URL < backup-pre-upgrade.sql

# Start previous version
docker-compose up -d app  # Will use old image if still present

# Or build previous version
docker build -t booking-system:v1.0.0 -f Dockerfile.v1.0.0 .
docker-compose up -d app
```

---

## Security

### Network Security

```bash
# Restrict port exposure
# ❌ Bad - exposed to internet
docker run -p 3000:3000 ...

# ✅ Good - only local access
docker run -p 127.0.0.1:3000:3000 ...

# ✅ Better - behind reverse proxy (nginx)
# Configure nginx to handle SSL, rate limiting
```

### SSL/TLS

```nginx
# nginx.conf
upstream booking {
  server app:3000;
}

server {
  listen 443 ssl http2;
  server_name api.example.com;

  ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

  location / {
    proxy_pass http://booking;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name api.example.com;
  return 301 https://$server_name$request_uri;
}
```

### Database Security

```sql
-- Limit user permissions
CREATE USER app_user WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE emerald TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Disable public access
REVOKE ALL ON SCHEMA public FROM PUBLIC;
```

### Secrets Management

**Option 1: Environment Variables**
```bash
export DATABASE_URL="postgresql://..."
export TELEGRAM_BOT_TOKEN="..."
```

**Option 2: Secrets Manager**
```bash
# AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id booking-system/prod

# Docker Secrets (Swarm)
echo "password" | docker secret create db_password -

# Or use 1Password, HashiCorp Vault, etc.
```

---

## Performance Tuning

### PostgreSQL Tuning

```ini
# postgresql.conf

# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB

# Parallelization
max_parallel_workers_per_gather = 2
max_parallel_workers = 4

# Logging
log_statement = 'all'
log_duration = on
log_min_duration_statement = 1000  # Log queries > 1 second
```

### Query Optimization

```typescript
// ❌ N+1 query problem
const series = await prisma.eventSeries.findMany();
for (const s of series) {
  const instances = await prisma.eventInstance.findMany({
    where: { seriesId: s.id }
  });
  // Makes one query per series
}

// ✅ Efficient - single query with join
const series = await prisma.eventSeries.findMany({
  include: { instances: true }
});
```

### Connection Pooling

Use pgBouncer or similar to limit database connections:
```ini
max_client_conn = 1000
default_pool_size = 25
```

---

## Disaster Recovery

### Recovery Time Objective (RTO)

**Goal**: Restore service within 1 hour

**Plan**:
1. Backup available (daily)
2. Database restore: ~10 minutes
3. App restart: ~5 minutes
4. Testing: ~10 minutes
5. **Total**: ~30 minutes

### Recovery Point Objective (RPO)

**Goal**: Lose no more than 24 hours of data

**Implementation**:
- Daily backups at 2 AM
- Keep 30 days of backups
- Test restore process monthly

### Checklist

- [ ] Backups tested monthly
- [ ] Runbooks documented
- [ ] Contact info updated
- [ ] Team trained on recovery
- [ ] Documentation up to date

---

## Maintenance Windows

### Schedule

**Recommended**: Sunday 2-4 AM (low traffic)

### Announcement

```
🔧 Maintenance Scheduled

Sunday, January 26 from 2-4 AM UTC

During this time:
- Bot may be unavailable
- Announcements won't send
- Voting won't work

Estimated impact: 30 minutes

Thank you for your patience!
```

### Procedure

```bash
# 1 hour before: announce
pnpm create-account "Maintenance notice"

# Disable bot (optional)
# - Rename /commands to disablecommands
# - Or set bot unavailable in Telegram

# Perform maintenance
# - Update code
# - Migrate database
# - Restart services

# Test
curl http://localhost:3000/health

# Re-enable bot
# Verify with /help command

# Post-maintenance: announce completion
```

---

## Support and Runbooks

Keep updated runbooks for:
- [ ] Emergency shutdown
- [ ] Service restart
- [ ] Database restore
- [ ] Performance degradation
- [ ] Security incident
- [ ] Data loss scenario

Store in wiki or documentation system with version history.

