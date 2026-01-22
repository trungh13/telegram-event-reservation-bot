# AGENTS.md

> Project Vision and Context for AI Agents

## Project Overview

**Name**: Event Booking System for Telegram  
**Type**: Multi-tenant SaaS Bot  
**Stack**: NestJS + PostgreSQL + Telegraf + Prisma

A Telegram-first event booking system that enables group administrators to manage recurring events (yoga classes, team meetings, sports sessions) directly within Telegram. The bot handles scheduling, automated announcements, participant voting, and capacity management.

---

## Core Concepts

### Multi-Tenancy
- **Account**: An organization/tenant. One bot instance serves multiple Accounts.
- **ApiKey**: Used to bind Telegram users to an Account via `/start <key>`.
- **AccountUserBinding**: Links a TelegramUser to an Account with a role (OWNER, ADMIN, MEMBER).

### Event Model
- **EventSeries**: A recurring event template with RRule, target group, and capacity settings.
- **EventInstance**: A concrete occurrence materialized from a series (e.g., "Yoga on Jan 22").
- **ParticipationLog**: Append-only log of votes (JOIN, LEAVE, PLUS_ONE).

### Telegram Integration
- **Group Targeting**: Events are posted to specific Telegram groups/topics.
- **Inline Voting**: Participants click buttons to join/leave events.
- **Live Updates**: Announcement messages are edited in real-time to reflect attendance.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         NestJS Application                      │
├─────────────────────────────────────────────────────────────────┤
│  TelegramModule    │  EventModule    │  SchedulerModule         │
│  - Commands        │  - CRUD         │  - Cron Jobs             │
│  - Voting          │  - Formatting   │  - Auto-Announce         │
├─────────────────────────────────────────────────────────────────┤
│  AccountModule     │  ParticipationModule │  TelegramUserModule │
│  - Binding         │  - Vote Logging      │  - User Upsert      │
├─────────────────────────────────────────────────────────────────┤
│                         PrismaModule (Global)                   │
│                         PostgreSQL Database                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Services

| Service | Responsibility |
| :--- | :--- |
| `TelegramService` | Handles all bot commands and inline button actions. |
| `EventService` | Creates series, formats attendance messages. |
| `SchedulerService` | Runs cron to materialize instances and auto-announce. |
| `AccountService` | Manages API keys and user bindings. |
| `ParticipationService` | Logs votes and calculates attendance. |

---

## Data Models (Prisma)

| Model | Key Fields |
| :--- | :--- |
| `Account` | `id`, `name`, `apiKeys[]`, `bindings[]` |
| `ApiKey` | `key` (unique), `accountId` |
| `TelegramUser` | `id` (BigInt), `username`, profile info |
| `AccountUserBinding` | `accountId`, `telegramUserId`, `role` |
| `EventSeries` | `title`, `recurrence` (JSON RRule), `chatId`, `maxParticipants` |
| `EventInstance` | `seriesId`, `startTime`, `announcementMessageId` |
| `ParticipationLog` | `instanceId`, `telegramUserId`, `action` |

---

## Command Reference

| Command | Context | Description |
| :--- | :--- | :--- |
| `/start <key>` | Private | Bind user to an Account |
| `/create` | Private/Group | Create event series with flags |
| `/list` | Private | Show active series |
| `/announce <id>` | Private | Manually post event card |
| `/id` | Any | Get current chat/topic ID |
| `/help` | Any | Show detailed usage guide |

### `/create` Flags

| Flag | Required | Description |
| :--- | :--- | :--- |
| `title` | Yes | Event name |
| `rrule` | Yes | iCal recurrence rule |
| `group` | Yes* | Target Telegram group ID |
| `date` | No | First occurrence (dd/mm/yyyy HH:mm) |
| `limit` | No | Max participants |
| `topic` | No | Forum topic ID |

---

## Scheduling Logic

1. **Cron Job**: Runs daily at midnight.
2. **Materialization Window**: 48 hours ahead.
3. **RRule Parsing**: Uses `rrule` library with `dtstart` from series creation.
4. **Auto-Announce**: If `chatId` is set, posts event card to group automatically.
5. **Admin Notification**: Notifies OWNER/ADMIN via private message.

---

## Testing Strategy

| Layer | Tool | Coverage |
| :--- | :--- | :--- |
| Unit | Jest | Services, parsers, formatters |
| Integration | Supertest | Webhook endpoints |
| Manual | Curl/Bot | Full user flows |

---

## Development Workflow

```bash
# Start development
pnpm start:dev

# Run tests
pnpm test

# Generate Prisma client after schema changes
pnpm prisma generate

# Create a new account
pnpm create-account "My Org"
```

---

## Current Phase

- **Completed**: Phases 0-2.8 (Foundation → Documentation)
- **Next**: Phase 3 (Monetization - Stripe Integration)

---

## Agent Instructions

When working on this project:

1. **Follow SOLID principles** - Single responsibility, dependency injection.
2. **Use atomic commits** - One logical change per commit.
3. **Explicit types** - No `any` unless absolutely necessary (with comment).
4. **Meaningful names** - Variables > 3 characters, self-documenting.
5. **Test first** - Write/update tests for new functionality.
6. **Update docs** - Keep specs and PRD in sync with code changes.
