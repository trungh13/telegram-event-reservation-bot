# Database Schema Documentation

Complete reference for the Event Booking System database design.

---

## Overview

The database uses **PostgreSQL 15** with **Prisma ORM** for type-safe database access.

**Key Design Principles**:
- **Multi-tenant**: Each Account is completely isolated
- **Append-only logs**: ParticipationLog is immutable (only inserts, no updates)
- **Event materialization**: EventSeries generates EventInstances daily via cron
- **Flexibility**: JSON fields store complex structures (RRule, payloads)

---

## Entity Relationship Diagram

```
┌─────────────┐
│   Account   │────────────────────────┐
│ (Tenant)    │                        │
└──────┬──────┘                        │
       │                               │
       ├──────────┬────────────────┬───┴─────────┐
       │          │                │             │
       v          v                v             v
    ApiKey   Binding          EventSeries   AuditLog
              (Role)             │
                                 │
                          ┌──────┴──────┐
                          │             │
                          v             v
                   EventInstance   Participation
                        │           Log
                        │           (Append-only)
                        └─────┬──────┘
                              │
                              v
                        TelegramUser
```

---

## Data Models

### Account
**Purpose**: Represents an organization or tenant using the system.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PRIMARY KEY, default: uuid() | Unique account identifier |
| `name` | String | NOT NULL | Organization name |
| `createdAt` | DateTime | NOT NULL, default: now() | Creation timestamp |
| `updatedAt` | DateTime | NOT NULL, auto-update | Last modification timestamp |

**Relations**:
- `apiKeys[]` - Multiple API keys for binding users
- `bindings[]` - User memberships with roles
- `events[]` - Event series created by this account
- `auditLogs[]` - Action history

**Example**:
```sql
SELECT * FROM accounts WHERE id = 'abc-123-def';
-- Returns: { id: 'abc-123-def', name: 'Tech Team', createdAt: ..., updatedAt: ... }
```

**Design Decision**: UUID instead of serial ID provides better privacy and avoids enumeration attacks.

---

### ApiKey
**Purpose**: Authenticates users when they run `/start <key>` command.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PRIMARY KEY, default: uuid() | Internal ID |
| `key` | String | UNIQUE, NOT NULL | Actual API key |
| `accountId` | String (UUID) | FOREIGN KEY → Account | Linked account |
| `createdAt` | DateTime | NOT NULL, default: now() | Generation timestamp |

**Format**: `sk_<48 hex characters>` (starts with "sk_", length ~50)

**Relations**:
- `account` - The Account this key grants access to

**Security**:
- Keys are hashed in production (current implementation stores plaintext - upgrade needed)
- One key can bind multiple users to same account
- No expiration in current version (consider adding TTL for Phase 3)

**Example**:
```sql
SELECT * FROM api_keys WHERE key = 'sk_abc123...';
-- Returns: { id: 'key-1', key: 'sk_abc123...', accountId: 'acc-1', createdAt: ... }
```

---

### TelegramUser
**Purpose**: Stores Telegram user profiles, independent of Account membership.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | BigInt | PRIMARY KEY | Telegram user ID (immutable) |
| `username` | String | Nullable | Telegram username (@username) |
| `firstName` | String | Nullable | User's first name |
| `lastName` | String | Nullable | User's last name |
| `languageCode` | String | Nullable | User's Telegram language setting |
| `createdAt` | DateTime | NOT NULL, default: now() | First seen timestamp |
| `updatedAt` | DateTime | NOT NULL, auto-update | Profile update timestamp |

**Relations**:
- `bindings[]` - Links to Accounts via AccountUserBinding
- `participation[]` - Vote records in ParticipationLog

**Design Decision**: BigInt ID because Telegram IDs can exceed JavaScript's number limit (>2^53).

**Example**:
```sql
SELECT * FROM telegram_users WHERE username = 'john_doe';
-- Returns: { id: 123456789, username: 'john_doe', firstName: 'John', ... }
```

---

### AccountUserBinding
**Purpose**: Links TelegramUsers to Accounts with specific roles.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PRIMARY KEY | Internal ID |
| `accountId` | String (UUID) | FOREIGN KEY → Account, NOT NULL | Organization |
| `telegramUserId` | BigInt | FOREIGN KEY → TelegramUser, NOT NULL | User |
| `role` | String | default: 'MEMBER' | OWNER \| ADMIN \| MEMBER |
| `createdAt` | DateTime | NOT NULL, default: now() | Binding timestamp |
| **Composite** | | UNIQUE(accountId, telegramUserId) | One binding per user per account |

**Relations**:
- `account` - The Account
- `telegramUser` - The Telegram user

**Roles**:
- `OWNER` - Created account via /start, full permissions
- `ADMIN` - Can manage events (future: granular permissions)
- `MEMBER` - Can only see/vote on events (future: read-only)

**Design Decision**: Unique constraint on (accountId, telegramUserId) prevents duplicate memberships while allowing users to join multiple accounts.

**Example**:
```sql
-- Find all users in account 'acc-1'
SELECT tu.*, aub.role FROM telegram_users tu
JOIN account_user_bindings aub ON tu.id = aub."telegramUserId"
WHERE aub."accountId" = 'acc-1';
```

---

### EventSeries
**Purpose**: Recurring event template. Generates concrete instances daily via scheduler.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PRIMARY KEY | Series identifier |
| `accountId` | String (UUID) | FOREIGN KEY → Account, NOT NULL | Owner account |
| `title` | String | NOT NULL | Event name |
| `description` | String | Nullable | Detailed description |
| `timezone` | String | default: 'Europe/Helsinki' | IANA timezone for scheduling |
| `recurrence` | JSON | NOT NULL | RRule string or object |
| `chatId` | BigInt | Nullable | Target Telegram group ID |
| `topicId` | String | Nullable | Target forum topic ID |
| `maxParticipants` | Int | Nullable | Capacity limit (null = unlimited) |
| `isActive` | Boolean | default: true | Soft-delete flag |
| `createdAt` | DateTime | NOT NULL, default: now() | Creation timestamp |
| `updatedAt` | DateTime | NOT NULL, auto-update | Last update |

**Relations**:
- `account` - Owning Account
- `instances[]` - Generated EventInstance records

**Recurrence Field**:

Can be either string (iCal format) or parsed object:

```json
{
  "FREQ": "WEEKLY",
  "BYDAY": "MO,WE,FR",
  "INTERVAL": 1,
  "COUNT": 52
}
```

Or as string:
```
DTSTART:20260120T100000Z
FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=52
```

**Group Targeting**:
- `chatId`: Telegram group ID (negative number, e.g., -100123456789)
- `topicId`: Forum topic ID within group (string, e.g., "42")
- If both set: posts to topic within group
- If only chatId: posts to main chat
- If neither: manual announcements only via `/announce`

**Capacity**:
- `maxParticipants`: When set, JOIN/PLUS_ONE blocked if limit reached
- `null` = unlimited participants

**Design Decision**: JSON recurrence allows flexibility; iCal format is industry standard.

**Example**:
```sql
-- Weekly yoga on Tuesday and Thursday
INSERT INTO event_series (id, "accountId", title, timezone, recurrence, "chatId", "maxParticipants", "isActive")
VALUES (
  'series-1',
  'acc-1',
  'Yoga Class',
  'Europe/Helsinki',
  'FREQ=WEEKLY;BYDAY=TU,TH',
  -100123456789,
  20,
  true
);
```

---

### EventInstance
**Purpose**: Concrete occurrence of an event, materialized from EventSeries.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PRIMARY KEY | Instance identifier |
| `seriesId` | String (UUID) | FOREIGN KEY → EventSeries, NOT NULL | Parent series |
| `startTime` | DateTime | NOT NULL | Event start time |
| `endTime` | DateTime | NOT NULL | Event end time |
| `status` | String | default: 'SCHEDULED' | SCHEDULED \| CANCELLED \| COMPLETED |
| `topicId` | String | Nullable | Override series topic |
| `chatId` | BigInt | Nullable | Override series chat |
| `announcementMessageId` | BigInt | Nullable | Telegram message ID |
| `announcementChatId` | BigInt | Nullable | Chat where posted |
| `createdAt` | DateTime | NOT NULL, default: now() | Materialization time |
| `updatedAt` | DateTime | NOT NULL, auto-update | Last update |
| **Composite** | | UNIQUE(seriesId, startTime) | One instance per time per series |

**Relations**:
- `series` - Parent EventSeries
- `participation[]` - Vote records

**Materialization**:
- Created daily by SchedulerService cron job
- Covers ~48-hour window
- Idempotent: checked before creating to avoid duplicates
- Auto-announced if series.chatId is set

**Announcement Tracking**:
- `announcementMessageId`: ID of Telegram message with voting buttons
- `announcementChatId`: Which chat it was posted to
- Used to update message live when votes change

**Design Decision**: Unique constraint on (seriesId, startTime) prevents duplicate instances while allowing series reschedules.

**Example**:
```sql
-- Get next 5 instances for a series
SELECT * FROM event_instances
WHERE "seriesId" = 'series-1'
ORDER BY "startTime" ASC
LIMIT 5;
```

---

### ParticipationLog
**Purpose**: Append-only log of voting actions (JOIN, LEAVE, PLUS_ONE).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PRIMARY KEY | Log entry ID |
| `instanceId` | String (UUID) | FOREIGN KEY → EventInstance, NOT NULL | Which event |
| `telegramUserId` | BigInt | FOREIGN KEY → TelegramUser, NOT NULL | Who voted |
| `action` | String | NOT NULL | JOIN \| LEAVE \| PLUS_ONE |
| `payload` | JSON | Nullable | Extra data (reason, +N count, etc) |
| `createdAt` | DateTime | NOT NULL, default: now() | Timestamp |

**Relations**:
- `instance` - EventInstance voted on
- `telegramUser` - User who voted

**Actions**:
- `JOIN` - User joining (count +1)
- `LEAVE` - User leaving (remove from attendance)
- `PLUS_ONE` - User bringing guest (count +2)

**Payload Examples**:
```json
{ "reason": "Attending with spouse" }
{ "guestCount": 2 }
{ "notes": "Bringing equipment" }
```

**Design Decision**: Append-only (no updates) enables:
- Vote history tracking
- Audit trail
- Analytics on participation patterns
- "Changed mind" scenarios (last action wins)

**Latest State Calculation**:
```sql
-- Get current attendance for an instance
-- (Most recent action per user)
WITH latest_votes AS (
  SELECT DISTINCT ON ("telegramUserId")
    "telegramUserId", action, "createdAt"
  FROM event_participation_log
  WHERE "instanceId" = 'inst-1'
  ORDER BY "telegramUserId", "createdAt" DESC
)
SELECT "telegramUserId", action
FROM latest_votes
WHERE action != 'LEAVE';
```

---

### AuditLog
**Purpose**: Track administrative actions on accounts (prepared for Phase 3).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PRIMARY KEY | Log entry ID |
| `accountId` | String (UUID) | FOREIGN KEY → Account, NOT NULL | Affected account |
| `actorId` | String | Nullable | User or system performing action |
| `action` | String | NOT NULL | CREATE_EVENT, CANCEL, PAYMENT_RECEIVED, etc. |
| `details` | JSON | Nullable | Structured action details |
| `occurredAt` | DateTime | NOT NULL, default: now() | Timestamp |

**Relations**:
- `account` - The affected Account

**Actions** (examples):
- `CREATE_EVENT` - Event series created
- `DELETE_EVENT` - Event series cancelled
- `PAYMENT_RECEIVED` - Subscription payment processed
- `API_KEY_GENERATED` - New API key created

**Example**:
```json
{
  "action": "CREATE_EVENT",
  "details": {
    "seriesId": "series-123",
    "title": "Weekly Standup",
    "frequency": "WEEKLY"
  }
}
```

---

## Key Indexes

Prisma automatically creates indexes for:
- Primary keys (all `id` fields)
- Foreign keys (all `@relation` fields)
- Unique constraints (API key, composite bindings)

**Additional recommended indexes** (for production):

```sql
-- Fast series lookup by account
CREATE INDEX idx_event_series_account_active
ON event_series(account_id, is_active);

-- Fast instance queries
CREATE INDEX idx_event_instance_series_time
ON event_instances(series_id, start_time);

-- Fast participation queries
CREATE INDEX idx_participation_instance
ON event_participation_log(instance_id, created_at DESC);

-- Fast user participation lookup
CREATE INDEX idx_participation_user
ON event_participation_log(telegram_user_id, created_at DESC);
```

---

## Constraints and Data Integrity

### Foreign Key Constraints
- Deleting Account cascades to ApiKey, EventSeries, AccountUserBinding, AuditLog
- Deleting EventSeries cascades to EventInstance
- Deleting EventInstance cascades to ParticipationLog
- Deleting TelegramUser cascades to AccountUserBinding, ParticipationLog

### Unique Constraints
- `ApiKey.key` - One API key format per key string
- `AccountUserBinding.(accountId, telegramUserId)` - One binding per user per account
- `EventInstance.(seriesId, startTime)` - One instance per series per time

### NOT NULL Constraints
- All IDs, timestamps, and foreign keys
- EventSeries.title, recurrence
- ParticipationLog.instanceId, telegramUserId, action
- AuditLog.accountId, action

---

## Growth and Scaling Considerations

### Data Volume

With 100 organizations, 1000 users, 10 events per org, average 20 participants:
- Accounts: ~100 rows (negligible)
- EventSeries: ~1,000 rows (negligible)
- EventInstances: ~1,000,000 rows (1 year daily, 1000 series × 365)
- ParticipationLog: ~10,000,000 rows (20 participants × 500 instances)

### Performance Impact

For **large deployments**:
1. Index strategies (see above)
2. Archive old EventInstance records
3. Aggregate ParticipationLog yearly
4. Read replicas for reporting queries
5. Connection pooling (pgBouncer)

### Archival Strategy (Future)

```sql
-- Archive instances older than 1 year
INSERT INTO event_instances_archive
SELECT * FROM event_instances
WHERE "createdAt" < NOW() - INTERVAL '1 year';

DELETE FROM event_instances
WHERE "createdAt" < NOW() - INTERVAL '1 year';
```

---

## Migrations

Migrations are stored in `prisma/migrations/` and applied with:

```bash
# Create new migration after schema changes
pnpm prisma migrate dev --name your_change_name

# Apply migrations in production
pnpm prisma migrate deploy

# Rollback last migration
pnpm prisma migrate resolve --rolled-back migration_name
```

---

## Querying Patterns

### Get all events for account with upcoming instances

```typescript
const activeSeries = await prisma.eventSeries.findMany({
  where: {
    accountId: 'acc-1',
    isActive: true,
  },
  include: {
    instances: {
      where: {
        startTime: { gte: new Date() },
      },
      orderBy: { startTime: 'asc' },
      take: 5,
    },
  },
});
```

### Get current attendance for event

```typescript
const allVotes = await prisma.participationLog.findMany({
  where: { instanceId: 'inst-1' },
  orderBy: { createdAt: 'desc' },
  include: { telegramUser: true },
});

// Calculate latest state
const latestVotes = new Map();
for (const vote of allVotes) {
  if (!latestVotes.has(vote.telegramUserId)) {
    latestVotes.set(vote.telegramUserId, vote);
  }
}

// Count attending
const attending = Array.from(latestVotes.values())
  .filter(v => v.action === 'JOIN' || v.action === 'PLUS_ONE')
  .reduce((sum, v) => sum + (v.action === 'PLUS_ONE' ? 2 : 1), 0);
```

### Find user's accounts

```typescript
const accounts = await prisma.accountUserBinding.findMany({
  where: { telegramUserId: 123456789n },
  include: { account: true },
});
```

---

## Best Practices

1. **Always include relations** when you need them (avoid N+1 queries)
2. **Use `findUnique` with composite keys** for safety
3. **Check null values** for optional fields
4. **Order by createdAt DESC** for audit logs
5. **Use transactions** for multi-model operations
6. **Archive old data** periodically to maintain performance

---

## Database Tools

### Prisma Studio
Visual database explorer:
```bash
pnpm prisma studio
# Opens http://localhost:5555
```

### psql
Direct PostgreSQL access:
```bash
psql $DATABASE_URL
```

### Adminer (Docker)
Web interface:
```bash
# Available at http://localhost:8080 with docker-compose
```

