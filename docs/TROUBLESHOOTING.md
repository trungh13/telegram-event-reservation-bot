# Troubleshooting Guide

Solutions for common issues when developing and running the Event Booking System.

---

## Development Setup

### Database Connection Fails

**Error**: `connect ECONNREFUSED 127.0.0.1:5432`

**Cause**: PostgreSQL not running

**Solutions**:

1. **Using Docker** (recommended):
   ```bash
   docker-compose up
   ```

2. **Using local PostgreSQL**:
   ```bash
   # macOS with Homebrew
   brew services start postgresql

   # Linux (systemd)
   sudo systemctl start postgresql

   # Windows
   # Open Services app and start "PostgreSQL"
   ```

3. **Check if PostgreSQL is running**:
   ```bash
   psql --version
   # If not installed, download from postgresql.org
   ```

4. **Verify port**:
   ```bash
   # Check if 5432 is listening
   lsof -i :5432  # macOS/Linux
   netstat -ano | findstr :5432  # Windows
   ```

---

### Database URL Format Error

**Error**: `ENOTFOUND emerald` or `authentication failed`

**Cause**: Incorrect DATABASE_URL format

**Check your .env**:
```bash
# View current value
grep DATABASE_URL .env
```

**Valid formats**:
```
# Local PostgreSQL
postgresql://postgres:password@localhost:5432/emerald

# With schema
postgresql://postgres:password@localhost:5432/emerald?schema=public

# Docker Compose
postgresql://admin:secret@postgres:5432/emerald

# Cloud PostgreSQL (Heroku, Supabase)
postgresql://user:password@host.compute.amazonaws.com:5432/dbname?schema=public
```

**Common mistakes**:
```
# ❌ Wrong - no schema parameter
DATABASE_URL="postgresql://user:pass@localhost/db"

# ❌ Wrong - using localhost for Docker
DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# ✅ Correct - includes schema
DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"

# ✅ Correct - using service name for Docker
DATABASE_URL="postgresql://user:pass@postgres:5432/db?schema=public"
```

---

### Prisma Client Not Found

**Error**: `PrismaClientInitializationError`

**Cause**: Prisma client not generated

**Solution**:
```bash
# Regenerate Prisma client
pnpm prisma generate

# Or full reset
rm -rf node_modules/.prisma
rm -rf dist
pnpm install
pnpm prisma generate
```

---

### Migrations Won't Apply

**Error**: `Error: Migration ... is locked`

**Cause**: Migration in progress or failed mid-way

**Solution**:
```bash
# Resolve the locked migration
pnpm prisma migrate resolve --rolled-back <migration_name>

# Then retry
pnpm prisma migrate dev

# If still stuck, reset database (WARNING: deletes data)
pnpm prisma migrate reset

# Confirm with yes when prompted
```

**For production**:
```bash
# Use deploy instead (won't ask for confirmation)
pnpm prisma migrate deploy
```

---

### Schema Validation Errors

**Error**: `Database schema out of sync`

**Cause**: Schema and migrations don't match

**Solution**:
```bash
# Validate schema matches migrations
pnpm prisma db validate

# If issues found, create migration
pnpm prisma migrate dev --name fix_schema

# Or in production:
pnpm prisma migrate deploy
```

---

## Bot Configuration

### Bot Token Invalid

**Error**: Bot doesn't respond to messages

**Cause**: Invalid or missing TELEGRAM_BOT_TOKEN

**Solution**:

1. **Verify token in .env**:
   ```bash
   grep TELEGRAM_BOT_TOKEN .env
   ```

2. **Check token format**:
   - Should be: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
   - Pattern: `<digits>:<characters>`
   - Length: Usually 45-50 characters

3. **Get new token**:
   - Open Telegram
   - Message [@BotFather](https://t.me/BotFather)
   - Type `/newbot` and follow prompts
   - Copy token and update .env

4. **Restart bot**:
   ```bash
   # Stop current process (Ctrl+C)
   pnpm start:dev
   ```

---

### Bot Name Mismatch

**Error**: Bot responds slowly or commands don't work

**Cause**: TELEGRAM_BOT_NAME doesn't match actual bot username

**Solution**:

1. **Find your bot's username**:
   - Open Telegram
   - Message [@BotFather](https://t.me/BotFather)
   - Type `/mybots` and select your bot
   - Username shows at the top (without @)

2. **Update .env**:
   ```bash
   TELEGRAM_BOT_NAME=my_event_bot
   # No @ symbol, just the name
   ```

3. **Restart bot**:
   ```bash
   pnpm start:dev
   ```

---

### Bot Not Responding to Commands

**Error**: `/help` or `/start` doesn't work

**Cause**: Multiple possible issues

**Diagnostic steps**:

1. **Check bot is running**:
   ```bash
   # Should see "Listening on port 3000"
   pnpm start:dev
   ```

2. **Check bot is in chat**:
   - Send `/id` in chat where bot should work
   - If bot doesn't respond, it's not in the chat

3. **Check token validity**:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getMe"
   # Replace <TOKEN> with your actual token
   # Should return bot info
   ```

4. **Enable debug logging**:
   ```bash
   ENV=dev pnpm start:dev
   # Look for command processing logs
   ```

5. **Check webhook**:
   - Bot uses webhook for updates
   - Should be listening on port 3000
   - Verify with: `curl http://localhost:3000/health`

---

### Bot Not Posting to Group

**Error**: `/announce` doesn't post to group

**Cause**: Bot doesn't have permissions in group

**Solution**:

1. **Add bot to group**:
   - Open target group in Telegram
   - Tap group name → Add members
   - Search for your bot
   - Select and add

2. **Grant permissions**:
   - Group settings → Permissions
   - Ensure bot can:
     - Send messages
     - Edit messages (for live updates)
     - See other members (for info)

3. **Test with `/id`**:
   ```
   /id
   # Should show negative group ID like: -100123456789
   ```

4. **Verify in code**:
   ```bash
   # Check bot is in group
   curl "https://api.telegram.org/bot<TOKEN>/getChatMember?chat_id=-100123&user_id=<BOT_ID>"
   # Replace values with your token and bot ID
   ```

---

## Command Issues

### /create Command Fails

**Error**: `❌ group is required`

**Cause**: Missing or invalid `group` flag

**Solution**:

1. **Get group ID**:
   - Go to target group
   - Run `/id` in that group
   - Copy the ID shown (should be negative)

2. **Use correct format**:
   ```
   /create title="Event Name" rrule="FREQ=WEEKLY" group="-100123456789"
   ```

3. **Check group ID format**:
   - Must start with `-100`
   - Must be a valid number
   - Example: `-100123456789`

---

### /create with Invalid RRule

**Error**: `❌ Invalid recurrence rule`

**Cause**: RRule syntax incorrect

**Valid RRule examples**:
```
FREQ=DAILY
FREQ=WEEKLY;BYDAY=MO,WE,FR
FREQ=WEEKLY;BYDAY=TU;COUNT=10
FREQ=MONTHLY;BYMONTHDAY=15
FREQ=YEARLY;BYMONTH=1
FREQ=WEEKLY;INTERVAL=2
```

**Invalid examples**:
```
FREQ:DAILY          # Wrong separator (: instead of =)
DAILY               # Missing FREQ=
FREQ=DAILY;DAYS=MO  # Wrong parameter name
```

**Fix**:
- Check [iCal documentation](https://tools.ietf.org/html/rfc5545)
- Use examples from `/help`
- Test in [RRule Tester](https://rrule.js.org/)

---

### /create with Date Parsing Failure

**Error**: `❌ Invalid date format`

**Cause**: Date doesn't match `dd/mm/yyyy HH:mm`

**Valid formats**:
```
25/01/2026 18:00   # ✅ Correct
25/1/2026 6:00     # ✅ Also works
```

**Invalid formats**:
```
2026-01-25         # ❌ Wrong separator
25-01-2026         # ❌ Wrong order
1/25/2026          # ❌ US format (mm/dd/yyyy)
6 PM               # ❌ Text format
```

**Fix**:
```
/create title="Yoga" rrule="FREQ=WEEKLY" group="-100123" date="25/01/2026 18:00"
```

---

### Capacity Checking Not Working

**Symptom**: Users can join even when at capacity

**Cause**: Multiple possible issues

**Diagnostic**:

1. **Check limit is set**:
   ```
   /list
   # View event and check limit is shown
   ```

2. **Check in database**:
   ```bash
   pnpm prisma studio
   # Open http://localhost:5555
   # Find the event series and check maxParticipants
   ```

3. **Check vote counting logic**:
   ```bash
   ENV=dev pnpm start:dev
   # Click JOIN button and watch debug logs
   # Should show current count vs limit
   ```

4. **Manually count votes**:
   ```sql
   SELECT COUNT(*) FROM event_participation_log
   WHERE "instanceId" = '<instance-id>'
   AND action IN ('JOIN', 'PLUS_ONE');
   ```

---

## Performance Issues

### Slow Bot Response

**Symptom**: Commands take >5 seconds to respond

**Cause**: Database or Telegram API slow

**Solutions**:

1. **Check database connection**:
   ```bash
   # Test query speed
   pnpm prisma studio
   # Run a simple query, should be <100ms
   ```

2. **Enable debug logging**:
   ```bash
   ENV=dev pnpm start:dev
   # Look for timing info in logs
   ```

3. **Check Telegram API**:
   ```bash
   # Is Telegram API slow?
   curl -w "%{time_total}" https://api.telegram.org/bot<TOKEN>/getMe
   ```

4. **Check local CPU/memory**:
   ```bash
   # Monitor while running
   top -p $(pgrep -f "nest start")  # macOS/Linux
   ```

---

### Cron Job Takes Too Long

**Symptom**: Materialization cron takes >5 minutes daily

**Cause**: Too many series or complex RRules

**Diagnostic**:

1. **Check cron logs**:
   ```bash
   ENV=dev pnpm start:dev
   # Watch logs at midnight (cron runs at 0 0 * * *)
   # Should see "Running materialization cron"
   ```

2. **Count series**:
   ```sql
   SELECT COUNT(*) FROM event_series WHERE "isActive" = true;
   ```

3. **Check RRule complexity**:
   ```sql
   SELECT title, recurrence FROM event_series LIMIT 5;
   # Look for very long/complex recurrence patterns
   ```

**Solutions**:
- Reduce instance materialization window (currently 48h)
- Archive inactive series
- Create indexes on event_series
- Split into multiple cron jobs

---

## Testing Issues

### Tests Won't Run

**Error**: `Module not found` or syntax errors

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Clear Jest cache
pnpm test -- --clearCache

# Try again
pnpm test
```

---

### Tests Timeout

**Error**: `Test timeout - Async callback was not invoked`

**Cause**: Mocks not set up correctly

**Solution**:

```typescript
// Make sure all async mocks are resolved
jest.spyOn(prisma.account, 'findUnique').mockResolvedValue({ id: 'a1' });
// ✅ Use .mockResolvedValue not .mockReturnValue

// Increase timeout for slow tests
it('slow test', async () => {
  // test code
}, 10000); // 10 second timeout
```

---

### Type Errors in Tests

**Error**: `Property 'x' does not exist on type 'any'`

**Cause**: Mock needs type definition

**Solution**:
```typescript
jest.spyOn(prisma.account, 'findUnique').mockResolvedValue({
  id: 'a1',
  name: 'Test',
  createdAt: new Date(),
  updatedAt: new Date(),
} as any); // Explicitly type as any if needed
```

---

## Port Already in Use

**Error**: `listen EADDRINUSE :::3000`

**Cause**: Another process using port 3000

**Solutions**:

1. **Find and kill process**:
   ```bash
   # macOS/Linux
   lsof -i :3000 | grep node | awk '{print $2}' | xargs kill -9

   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

2. **Use different port**:
   ```bash
   PORT=3001 pnpm start:dev
   ```

3. **Check what's using it**:
   ```bash
   lsof -i :3000
   # See what process is holding the port
   ```

---

## Docker Issues

### Container Won't Start

**Error**: Container exits immediately

**Solution**:
```bash
# Check logs
docker-compose logs

# Restart with logs visible
docker-compose up (don't use -d)

# Look for error messages
```

---

### Can't Connect to Database from App

**Error**: `connect ECONNREFUSED postgres:5432`

**Cause**: Database hostname wrong in Docker

**Fix**:
```
# ❌ Wrong in Docker - localhost won't work
DATABASE_URL="postgresql://admin:secret@localhost:5432/emerald"

# ✅ Correct in Docker - use service name
DATABASE_URL="postgresql://admin:secret@postgres:5432/emerald"
```

---

### Adminer Won't Load

**Error**: `http://localhost:8080` shows connection error

**Cause**: Database service not ready yet

**Solution**:
```bash
# Wait for database to be ready
docker-compose up  # Let it run for 30 seconds
docker-compose exec postgres psql -U admin -d emerald -c "SELECT 1"

# Then access Adminer
# Username: admin
# Password: secret
# Server: postgres
# Database: emerald
```

---

## Getting Help

1. **Check this guide first** - Most issues listed here
2. **Check project docs**:
   - [SETUP_GUIDE.md](SETUP_GUIDE.md) - Setup troubleshooting
   - [ERROR_HANDLING.md](ERROR_HANDLING.md) - Bot error codes
3. **Search GitHub issues** - Similar problems may be documented
4. **Enable debug mode** - `ENV=dev pnpm start:dev`
5. **Check logs** - Most errors logged with details

---

## Common Error Messages

| Message | Cause | Fix |
|---------|-------|-----|
| `connect ECONNREFUSED` | Database not running | Start PostgreSQL |
| `Invalid API key` | Bad token format | Get token from @BotFather |
| `RRULE_INVALID` | Bad recurrence syntax | Check FREQ=... format |
| `group is required` | Missing group flag | Add `group="-100..."`  |
| `No instances materialized` | Too early, cron pending | Wait for midnight or test manually |
| `Already announced` | Event posted before | Use new instance or delete message |
| `Cannot access group` | Bot not in group | Add bot to target group |
| `Only X slots left` | Capacity exceeded | Increase limit or wait for space |

