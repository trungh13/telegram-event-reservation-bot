# Technical Specifications

> Developer Reference for Event Booking System

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         NestJS Application                      │
├─────────────────────────────────────────────────────────────────┤
│  TelegramModule    │  EventModule    │  SchedulerModule         │
│  - Bot Commands    │  - Series CRUD  │  - Cron Jobs             │
│  - Inline Voting   │  - Formatting   │  - Auto-Announce         │
├─────────────────────────────────────────────────────────────────┤
│  AccountModule     │  ParticipationModule │  TelegramUserModule │
│  - API Key Binding │  - Vote Logging      │  - User Upsert      │
├─────────────────────────────────────────────────────────────────┤
│                         PrismaModule (Global)                   │
│                         PostgreSQL Database                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Models

| Model | Purpose | Key Fields |
| :--- | :--- | :--- |
| `Account` | Organization/Tenant | `name`, `apiKeys[]` |
| `ApiKey` | Auth token for binding | `key` (unique) |
| `TelegramUser` | Telegram user profile | `id` (BigInt), `username` |

> [!TIP]
> API keys are manually distributed by the administrator. Contact **@trungh13** on Telegram to request a key.
| `AccountUserBinding` | User-to-Account link | `role` (OWNER/ADMIN/MEMBER) |
| `EventSeries` | Recurring event template | `title`, `recurrence`, `chatId`, `maxParticipants` |
| `EventInstance` | Concrete occurrence | `startTime`, `announcementMessageId` |
| `ParticipationLog` | Vote history | `action` (JOIN/LEAVE/PLUS_ONE) |

---

## Command API

### `/create` - Create Event Series

```
/create title="..." rrule="..." group="..." [options]
```

| Flag | Required | Aliases | Description |
| :--- | :--- | :--- | :--- |
| `title` | Yes | | Event name |
| `rrule` | Yes | | iCal recurrence rule |
| `group` | Yes | `chat` | Target Telegram group ID (must be negative, e.g., `-1001234567890`) |
| `date` | No | `start` | First occurrence (`dd/mm/yyyy HH:mm`) |
| `limit` | No | | Max participants |
| `topic` | No | | Forum topic ID |

> **Note:** Group IDs are always negative (start with `-100`). Private chat IDs are positive. Use `/id` in a group to get its ID.

**Examples:**
```
# Weekly yoga every Tuesday
/create title="Yoga" rrule="FREQ=WEEKLY;BYDAY=TU" group="-100123"

# Daily standup with capacity limit
/create title="Standup" rrule="FREQ=DAILY" group="-100123" limit="10"

# Biweekly retro starting specific date
/create title="Retro" rrule="FREQ=WEEKLY;INTERVAL=2" group="-100123" date="25/01/2026 15:00"
```

### `/announce <series_id>` - Manual Announcement

Posts event card to target group. Prevents duplicates.

### `/list` - Show Active Series

Returns all series for user's Account with IDs and targets.

### `/id` - Get Chat Info

Returns current chat ID, type, and topic ID (if applicable).

---

## Scheduling Logic

1. **Cron**: Runs every minute (`* * * * *`)
2. **Window**: Materializes instances ~5-10 minutes before start (just-in-time)
3. **RRule**: Uses `rrulestr` for complex recurrence patterns
4. **Auto-Announce**: Posts to `chatId` if set, stores `announcementMessageId`
5. **Notifications**: Alerts OWNER/ADMIN via private message

> **Design Decision**: Just-in-time materialization prevents spamming groups with multiple announcements when a series is created. Instances are announced only minutes before they start.

---

## Testing

```bash
# Unit tests
pnpm test

# Specific service
pnpm test scheduler.service.spec.ts

# Coverage report
pnpm test:cov

# E2E tests
pnpm test:e2e
```

---

## Environment Variables

| Variable | Required | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `ENV` | No | Set to `dev` for debug logging |
