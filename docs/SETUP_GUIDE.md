# Setup Guide

Complete guide to set up the Event Booking System for local development.

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** 18+ ([download](https://nodejs.org/))
- **pnpm** 8+ (`npm install -g pnpm`)
- **PostgreSQL** 15+ ([download](https://www.postgresql.org/)) OR Docker
- **Git** for version control
- **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)

### Check Versions

```bash
node --version     # Should be v18.x or higher
pnpm --version     # Should be 8.x or higher
psql --version     # Should be PostgreSQL 15+
docker --version   # Only needed for Docker setup
```

---

## Quick Start (Docker Compose)

**Fastest option** - everything in containers:

```bash
# 1. Clone repository
git clone <repo-url>
cd booking-system

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your Telegram bot token
# Find TELEGRAM_BOT_TOKEN line and update it
nano .env  # or use your editor

# 4. Start all services
docker-compose up -d

# 5. Install dependencies
pnpm install

# 6. Run migrations
pnpm prisma migrate dev

# 7. Start development server
pnpm start:dev
```

**Verify it works:**
- Bot should be running
- Logs should show "Listening on port 3000"
- Send `/help` to your bot in Telegram

---

## Manual Setup (Local PostgreSQL)

For development without Docker:

### Step 1: Prepare Database

```bash
# Create PostgreSQL database
createdb telegram_event_reservation_bot

# Or using psql
psql -U postgres
CREATE DATABASE telegram_event_reservation_bot;
\q
```

### Step 2: Clone & Configure

```bash
# Clone repository
git clone <repo-url>
cd booking-system

# Copy and edit environment
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/telegram_event_reservation_bot"
TELEGRAM_BOT_TOKEN="your_token_here"
TELEGRAM_BOT_NAME="your_bot_username"
ENV="dev"
```

**Get your token:**
1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Type `/newbot` and follow prompts
3. Copy the token (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
4. Paste into `.env`

### Step 3: Install & Setup

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# Verify schema
pnpm prisma studio  # Opens visual database explorer
```

### Step 4: Start Development Server

```bash
# Start NestJS dev server with hot reload
pnpm start:dev

# In another terminal, test the bot:
# Send /help to your bot in Telegram
```

**Expected output:**
```
[Nest] 12345   - 01/23/2026, 10:30:45 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345   - 01/23/2026, 10:30:46 AM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345   - 01/23/2026, 10:30:47 AM     LOG Listening on port 3000
```

---

## Environment Variables

### Required

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://user:pass@localhost/db` | PostgreSQL connection string |
| `TELEGRAM_BOT_TOKEN` | `123456:ABCdef...` | Get from @BotFather |
| `TELEGRAM_BOT_NAME` | `my_event_bot` | Your bot's username (without @) |

### Optional

| Variable | Default | Notes |
|----------|---------|-------|
| `ENV` | `production` | Set to `dev` for debug logging |
| `POSTGRES_USER` | `admin` | Docker Compose only |
| `POSTGRES_PASSWORD` | `secret` | Docker Compose only |
| `POSTGRES_DB` | `telegram_event_reservation_bot` | Docker Compose only |

---

## Common Commands

### Development

```bash
# Start dev server with auto-reload
pnpm start:dev

# Run in debug mode (with detailed logging)
ENV=dev pnpm start:dev

# Start production build
pnpm build
pnpm start:prod
```

### Database

```bash
# Create new migration after schema changes
pnpm prisma migrate dev --name describe_change

# Reset database (WARNING: deletes all data)
pnpm prisma migrate reset

# View database in UI
pnpm prisma studio

# Validate schema
pnpm prisma db validate
```

### Testing

```bash
# Run all tests
pnpm test

# Watch mode (re-run on file changes)
pnpm test:watch

# Coverage report
pnpm test:cov

# Test specific file
pnpm test event.service.spec.ts
```

### Code Quality

```bash
# Run linter
pnpm lint

# Auto-fix linter issues
pnpm lint --fix

# Format code
pnpm format

# Type check
npx tsc --noEmit
```

### Create Test Account

```bash
# Create new organization and API key
pnpm create-account "My Organization"

# Output includes API key for /start command
```

---

## Testing the Bot

### 1. Create an Account

```bash
# Generate test account
pnpm create-account "Test Org"

# Output:
# Account created with ID: abc123
# API Key: sk_1234567890abcdef1234567890abcd
```

### 2. Bind Your User

In Telegram:
```
/start sk_1234567890abcdef1234567890abcd
```

Bot responds: "Successfully bound to account: Test Org!"

### 3. Get Chat IDs

```
/id
```

Bot returns:
```
Chat ID: 123456789
Type: private
```

Add bot to a group and run `/id` there to get the group's chat ID.

### 4. Create an Event

```
/create title="Test Event" rrule="FREQ=DAILY" group="-100123456789"
```

### 5. List Events

```
/list
```

### 6. Announce Event

```
/announce <series_id>
```

### 7. Test Voting

Click the JOIN/LEAVE/+1 buttons in the announcement.

---

## Docker Compose Services

The included `docker-compose.yml` provides three services:

### PostgreSQL 15
- **URL**: `postgres:5432`
- **Username**: `admin`
- **Password**: `secret`
- **Database**: `telegram_event_reservation_bot`

### Adminer (Database GUI)
- **URL**: `http://localhost:8080`
- **User**: `admin`
- **Password**: `secret`
- **Server**: `postgres`
- **Database**: `telegram_event_reservation_bot`

### NestJS App
- **URL**: `http://localhost:3000`
- **Webhook**: `http://localhost:3000/webhook/{token}`

---

## Troubleshooting

### PostgreSQL Connection Error

**Error**: `connect ECONNREFUSED 127.0.0.1:5432`

**Solutions**:
1. **Using Docker**: Run `docker-compose up`
2. **Using local PostgreSQL**:
   ```bash
   # macOS
   brew services start postgresql

   # Linux
   sudo systemctl start postgresql

   # Windows
   Open Services and start PostgreSQL
   ```
3. **Verify connection**:
   ```bash
   psql $DATABASE_URL
   ```

### Database URL Format

**Common mistake**: Missing schema parameter

```bash
# ❌ Wrong
DATABASE_URL="postgresql://user:pass@localhost/db"

# ✅ Correct
DATABASE_URL="postgresql://user:pass@localhost/db?schema=public"
```

### Prisma Client Issues

**Error**: `PrismaClientInitializationError`

**Solution**:
```bash
# Regenerate Prisma client
pnpm prisma generate

# Or full reset
rm -rf node_modules/.prisma
pnpm prisma generate
```

### Bot Token Invalid

**Error**: Bot doesn't respond to messages

**Solutions**:
1. Verify token in `.env`:
   ```bash
   grep TELEGRAM_BOT_TOKEN .env
   ```
2. Check token format: `123456:ABCdefGHI...`
3. Get new token from [@BotFather](https://t.me/BotFather)
4. Restart: `pnpm start:dev`

### Port Already in Use

**Error**: `listen EADDRINUSE :::3000`

**Solutions**:
1. Kill process using port:
   ```bash
   # macOS/Linux
   lsof -i :3000 | grep node | awk '{print $2}' | xargs kill -9

   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```
2. Use different port:
   ```bash
   PORT=3001 pnpm start:dev
   ```

### Migration Conflicts

**Error**: `Error: Migration ... is locked`

**Solution**:
```bash
# Resolve the failed migration
pnpm prisma migrate resolve --rolled-back create_tables

# Then retry
pnpm prisma migrate dev
```

### Tests Failing

**Error**: Tests pass locally but fail in CI

**Solutions**:
1. Ensure test database is clean:
   ```bash
   pnpm prisma migrate reset --force
   ```
2. Check NODE_ENV:
   ```bash
   NODE_ENV=test pnpm test
   ```
3. Review test database URL in `.env.test`

---

## Next Steps

1. ✅ Environment is set up
2. ✅ Bot is running
3. Read [AGENTS.md](./AGENTS.md) to understand architecture
4. Read [CONTRIBUTING.md](../CONTRIBUTING.md) for development workflow
5. Check [DATABASE.md](./DATABASE.md) to understand data models
6. Start implementing features!

---

## Getting Help

- **Setup issues**: Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Architecture**: Read [AGENTS.md](./AGENTS.md)
- **Contributing**: Check [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Technical details**: See [technical-specs.md](./technical-specs.md)

