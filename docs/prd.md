# Detailed PRD: Granular Tickets

> Event Booking System - Ticket Breakdown

This document contains granular, testable tickets organized by phase. Each ticket follows a standard format with acceptance criteria that can be verified via unit tests, E2E tests, or manual verification.

---

## Ticket Format

```json
{
  "id": "TICKET-ID",
  "title": "Short description",
  "type": "feature | development | docs",
  "acceptanceCriteria": [
    "Criterion 1",
    "Criterion 2"
  ],
  "testCommand": "pnpm test path/to/spec.ts",
  "passes": true | false
}
```

---

## Phase 0: Foundation

### INFRA-001: Project Scaffolding
```json
{
  "id": "INFRA-001",
  "title": "Initialize NestJS project with TypeScript",
  "type": "development",
  "acceptanceCriteria": [
    "NestJS project created with `nest new`",
    "TypeScript configured with strict mode",
    "`pnpm start:dev` runs without errors",
    "`pnpm test` passes with default tests"
  ],
  "testCommand": "pnpm test",
  "passes": true
}
```

### INFRA-002: Database Schema Setup
```json
{
  "id": "INFRA-002",
  "title": "Configure Prisma with PostgreSQL",
  "type": "development",
  "acceptanceCriteria": [
    "Prisma client installed and configured",
    "DATABASE_URL reads from environment",
    "`pnpm prisma generate` succeeds",
    "PrismaModule is @Global and exported"
  ],
  "testCommand": "pnpm prisma generate",
  "passes": true
}
```

### INFRA-003: Core Models - Account & ApiKey
```json
{
  "id": "INFRA-003",
  "title": "Add Account and ApiKey models to schema",
  "type": "development",
  "acceptanceCriteria": [
    "Account model has id, name, timestamps",
    "ApiKey model has key (unique), accountId",
    "Relation: Account hasMany ApiKey",
    "Migration runs successfully"
  ],
  "testCommand": "pnpm prisma migrate dev --name add_account_apikey",
  "passes": true
}
```

### INFRA-004: Telegram Webhook Controller
```json
{
  "id": "INFRA-004",
  "title": "Create webhook endpoint for Telegram updates",
  "type": "development",
  "acceptanceCriteria": [
    "POST /webhook/:token endpoint exists",
    "Validates token matches TELEGRAM_BOT_TOKEN",
    "Passes update to Telegraf for processing",
    "Returns 200 OK on success"
  ],
  "testCommand": "curl -X POST http://localhost:3000/webhook/TEST -d '{}'",
  "passes": true
}
```

---

## Phase 1: Core Implementation

### CORE-001: TelegramUser Model
```json
{
  "id": "CORE-001",
  "title": "Add TelegramUser model to schema",
  "type": "development",
  "acceptanceCriteria": [
    "TelegramUser model with BigInt id",
    "Fields: username, firstName, lastName, languageCode",
    "Unique constraint on id",
    "Migration runs successfully"
  ],
  "testCommand": "pnpm prisma migrate dev",
  "passes": true
}
```

### CORE-002: AccountUserBinding Model
```json
{
  "id": "CORE-002",
  "title": "Add AccountUserBinding for multi-tenancy",
  "type": "development",
  "acceptanceCriteria": [
    "Model links Account to TelegramUser",
    "role field with default 'MEMBER'",
    "Unique constraint on (accountId, telegramUserId)",
    "Relations to both parent models"
  ],
  "testCommand": "pnpm prisma migrate dev",
  "passes": true
}
```

### CORE-003: /start Command - Account Binding
```json
{
  "id": "CORE-003",
  "title": "Implement /start <key> command",
  "type": "feature",
  "acceptanceCriteria": [
    "/start <key> looks up ApiKey in database",
    "Valid key creates/updates TelegramUser",
    "Creates AccountUserBinding with OWNER role",
    "Invalid key returns error message",
    "No key shows welcome/help message"
  ],
  "testCommand": "pnpm test telegram.service.spec.ts",
  "passes": true
}
```

### CORE-004: EventSeries Model
```json
{
  "id": "CORE-004",
  "title": "Add EventSeries model to schema",
  "type": "development",
  "acceptanceCriteria": [
    "Fields: title, description, timezone, recurrence (JSON)",
    "Relation to Account",
    "isActive boolean flag",
    "Migration runs successfully"
  ],
  "testCommand": "pnpm prisma migrate dev",
  "passes": true
}
```

### CORE-005: EventInstance Model
```json
{
  "id": "CORE-005",
  "title": "Add EventInstance model to schema",
  "type": "development",
  "acceptanceCriteria": [
    "Fields: startTime, endTime, status",
    "Relation to EventSeries",
    "Unique constraint on (seriesId, startTime)",
    "Migration runs successfully"
  ],
  "testCommand": "pnpm prisma migrate dev",
  "passes": true
}
```

### CORE-006: EventService - Create Series
```json
{
  "id": "CORE-006",
  "title": "Implement EventService.createSeries",
  "type": "feature",
  "acceptanceCriteria": [
    "Creates EventSeries with provided data",
    "Validates required fields (title, rrule)",
    "Stores recurrence as JSON",
    "Returns created series object"
  ],
  "testCommand": "pnpm test event.service.spec.ts",
  "passes": true
}
```

### CORE-007: SchedulerService - Materialization
```json
{
  "id": "CORE-007",
  "title": "Implement cron-based instance materialization",
  "type": "feature",
  "acceptanceCriteria": [
    "Cron job runs daily (configurable)",
    "Queries active EventSeries",
    "Uses rrule to calculate next occurrences",
    "Creates EventInstance for each occurrence in window",
    "Idempotent: skips existing instances"
  ],
  "testCommand": "pnpm test scheduler.service.spec.ts",
  "passes": true
}
```

### CORE-008: /create Command - Basic
```json
{
  "id": "CORE-008",
  "title": "Implement /create command with positional args",
  "type": "feature",
  "acceptanceCriteria": [
    "Parses: /create <title> <rrule>",
    "Validates user is bound to an Account",
    "Creates EventSeries via EventService",
    "Returns confirmation with series ID"
  ],
  "testCommand": "pnpm test telegram.service.spec.ts",
  "passes": true
}
```

---

## Phase 2: Hardening

### HARD-001: Named Argument Parser
```json
{
  "id": "HARD-001",
  "title": "Implement key=value argument parsing",
  "type": "development",
  "acceptanceCriteria": [
    "parseKeyValueArgs extracts key=\"value\" pairs",
    "Handles quoted values with spaces",
    "Order-independent parsing",
    "Falls back to positional if no = present"
  ],
  "testCommand": "pnpm test telegram.service.spec.ts",
  "passes": true
}
```

### HARD-002: /create Command - Named Args
```json
{
  "id": "HARD-002",
  "title": "Update /create to support named arguments",
  "type": "feature",
  "acceptanceCriteria": [
    "Accepts title=\"...\" rrule=\"...\" format",
    "Respects flag aliases (group/chat, date/start)",
    "group flag is required",
    "Returns helpful error for missing required flags"
  ],
  "testCommand": "pnpm test telegram.service.spec.ts",
  "passes": true
}
```

### HARD-003: Group Targeting Fields
```json
{
  "id": "HARD-003",
  "title": "Add chatId and topicId to EventSeries",
  "type": "development",
  "acceptanceCriteria": [
    "chatId field (BigInt, nullable)",
    "topicId field (String, nullable)",
    "Migration runs successfully",
    "EventService accepts these fields on create"
  ],
  "testCommand": "pnpm prisma migrate dev",
  "passes": true
}
```

### HARD-004: /id Command
```json
{
  "id": "HARD-004",
  "title": "Implement /id helper command",
  "type": "feature",
  "acceptanceCriteria": [
    "Returns current chat ID",
    "Returns chat type (private/group/supergroup)",
    "Returns topic ID if in a forum topic",
    "Works in both private and group chats"
  ],
  "testCommand": "pnpm test telegram.service.spec.ts",
  "passes": true
}
```

### HARD-005: /list Command
```json
{
  "id": "HARD-005",
  "title": "Implement /list to show active series",
  "type": "feature",
  "acceptanceCriteria": [
    "Queries EventSeries for user's Account",
    "Displays series ID, title, recurrence summary",
    "Shows target group if set",
    "Returns 'No series found' if empty"
  ],
  "testCommand": "pnpm test telegram.service.spec.ts",
  "passes": true
}
```

### HARD-006: /announce Command - Basic
```json
{
  "id": "HARD-006",
  "title": "Implement /announce to post event cards",
  "type": "feature",
  "acceptanceCriteria": [
    "Accepts series_id argument",
    "Finds next upcoming EventInstance",
    "Posts formatted message to series.chatId",
    "Includes inline voting buttons"
  ],
  "testCommand": "pnpm test telegram.service.spec.ts",
  "passes": true
}
```

### HARD-007: Inline Voting Buttons
```json
{
  "id": "HARD-007",
  "title": "Add JOIN/LEAVE/+1 inline buttons",
  "type": "feature",
  "acceptanceCriteria": [
    "Announcement includes 3 inline buttons",
    "Button callbacks contain action:instanceId",
    "Clicking button triggers recordVote handler"
  ],
  "testCommand": "Manual: click buttons on announcement",
  "passes": true
}
```

### HARD-008: ParticipationLog Model
```json
{
  "id": "HARD-008",
  "title": "Add ParticipationLog model",
  "type": "development",
  "acceptanceCriteria": [
    "Fields: instanceId, telegramUserId, action, payload",
    "Append-only (no updates, only inserts)",
    "Relations to EventInstance and TelegramUser",
    "Migration runs successfully"
  ],
  "testCommand": "pnpm prisma migrate dev",
  "passes": true
}
```

### HARD-009: ParticipationService
```json
{
  "id": "HARD-009",
  "title": "Implement ParticipationService.recordVote",
  "type": "feature",
  "acceptanceCriteria": [
    "Creates ParticipationLog entry",
    "Handles JOIN, LEAVE, PLUS_ONE actions",
    "Returns latest vote status for user"
  ],
  "testCommand": "pnpm test participation.service.spec.ts",
  "passes": true
}
```

---

## Phase 2.5: Advanced Features

### ADV-001: RRuleSet Support
```json
{
  "id": "ADV-001",
  "title": "Support complex recurrence with rrulestr",
  "type": "feature",
  "acceptanceCriteria": [
    "SchedulerService uses rrulestr for parsing",
    "Supports multiple RRULE lines",
    "Handles EXRULE and EXDATE",
    "Unit test with complex schedule"
  ],
  "testCommand": "pnpm test scheduler.service.spec.ts",
  "passes": true
}
```

---

## Phase 2.6: Booking Refinement

### REF-001: Capacity Limit Field
```json
{
  "id": "REF-001",
  "title": "Add maxParticipants to EventSeries",
  "type": "development",
  "acceptanceCriteria": [
    "maxParticipants field (Int, nullable)",
    "Migration runs successfully",
    "EventService accepts limit on create"
  ],
  "testCommand": "pnpm prisma migrate dev",
  "passes": true
}
```

### REF-002: Capacity Enforcement
```json
{
  "id": "REF-002",
  "title": "Block votes when capacity reached",
  "type": "feature",
  "acceptanceCriteria": [
    "recordVote checks current attendance count",
    "JOIN blocked if count >= maxParticipants",
    "PLUS_ONE blocked if count+2 > maxParticipants",
    "User receives friendly alert"
  ],
  "testCommand": "pnpm test telegram.service.spec.ts",
  "passes": true
}
```

### REF-003: Announcement Tracking Fields
```json
{
  "id": "REF-003",
  "title": "Add announcementMessageId to EventInstance",
  "type": "development",
  "acceptanceCriteria": [
    "announcementMessageId field (BigInt, nullable)",
    "announcementChatId field (BigInt, nullable)",
    "Migration runs successfully"
  ],
  "testCommand": "pnpm prisma migrate dev",
  "passes": true
}
```

### REF-004: Duplicate Prevention
```json
{
  "id": "REF-004",
  "title": "Prevent duplicate announcements",
  "type": "feature",
  "acceptanceCriteria": [
    "/announce checks if instance.announcementMessageId exists",
    "Returns error if already announced",
    "Stores messageId after successful announce"
  ],
  "testCommand": "pnpm test telegram.service.spec.ts",
  "passes": true
}
```

### REF-005: Live Attendance List
```json
{
  "id": "REF-005",
  "title": "Update announcement message on vote",
  "type": "feature",
  "acceptanceCriteria": [
    "recordVote triggers message re-render",
    "Uses editMessageText Telegram API",
    "Shows attendee names and count",
    "Shows capacity if limit is set"
  ],
  "testCommand": "Manual: vote and observe message update",
  "passes": true
}
```

### REF-006: Centralized Message Formatter
```json
{
  "id": "REF-006",
  "title": "Move attendance formatting to EventService",
  "type": "development",
  "acceptanceCriteria": [
    "EventService.formatAttendanceMessage method",
    "TelegramService uses this for /announce",
    "SchedulerService uses this for auto-announce",
    "Consistent output across all channels"
  ],
  "testCommand": "pnpm test event.service.spec.ts",
  "passes": true
}
```

---

## Phase 2.7: Auto-Announcements

### AUTO-001: Auto-Announce on Materialization
```json
{
  "id": "AUTO-001",
  "title": "Auto-post events when materialized",
  "type": "feature",
  "acceptanceCriteria": [
    "SchedulerService posts to chatId after creating instance",
    "Only triggers if series.chatId is set",
    "Stores announcementMessageId on instance",
    "Includes voting buttons"
  ],
  "testCommand": "pnpm test scheduler.service.spec.ts",
  "passes": true
}
```

### AUTO-002: Admin Notification Fix
```json
{
  "id": "AUTO-002",
  "title": "Notify OWNER and ADMIN on materialization",
  "type": "feature",
  "acceptanceCriteria": [
    "notifyAdmins queries role IN ['ADMIN', 'OWNER']",
    "Private message sent to each admin",
    "Message indicates auto-announce status"
  ],
  "testCommand": "pnpm test scheduler.service.spec.ts",
  "passes": true
}
```

### AUTO-003: Circular Dependency Resolution
```json
{
  "id": "AUTO-003",
  "title": "Fix circular dependency between modules",
  "type": "development",
  "acceptanceCriteria": [
    "SchedulerModule imports EventModule with forwardRef",
    "EventModule imports SchedulerModule with forwardRef",
    "Application boots without UnknownDependenciesException"
  ],
  "testCommand": "pnpm start:dev",
  "passes": true
}
```

---

## Phase 2.8: Documentation

### DOC-001: Enhanced /help Command
```json
{
  "id": "DOC-001",
  "title": "Detailed flag documentation in /help",
  "type": "docs",
  "acceptanceCriteria": [
    "/help shows all command flags",
    "Required vs optional clearly marked",
    "Common examples provided",
    "RRule cheat sheet included"
  ],
  "testCommand": "Manual: send /help to bot",
  "passes": true
}
```

### DOC-002: AGENTS.md
```json
{
  "id": "DOC-002",
  "title": "Create AGENTS.md for AI context",
  "type": "docs",
  "acceptanceCriteria": [
    "Project overview and architecture",
    "Data models summary",
    "Command reference",
    "Development workflow instructions"
  ],
  "testCommand": "Manual: review file",
  "passes": true
}
```

### DOC-003: Detailed PRD with Tickets
```json
{
  "id": "DOC-003",
  "title": "Create granular ticket breakdown",
  "type": "docs",
  "acceptanceCriteria": [
    "Tickets organized by phase",
    "Each ticket has acceptance criteria",
    "Test command specified where applicable",
    "Pass/fail status tracked"
  ],
  "testCommand": "Manual: review file",
  "passes": true
}
```

---

## Phase 3: Monetization (Planned)

### PAY-001: Stripe Checkout Integration
```json
{
  "id": "PAY-001",
  "title": "Add Stripe checkout for subscriptions",
  "type": "feature",
  "acceptanceCriteria": [
    "Stripe SDK installed and configured",
    "/subscribe command initiates checkout",
    "Checkout session created with proper metadata",
    "Success/cancel URLs configured"
  ],
  "testCommand": "Manual: complete checkout flow",
  "passes": false
}
```

### PAY-002: Subscription Plans
```json
{
  "id": "PAY-002",
  "title": "Define subscription tiers",
  "type": "development",
  "acceptanceCriteria": [
    "Plan model in database",
    "Free tier limits (e.g., 1 series, 5 participants)",
    "Pro tier unlocks full features",
    "Account linked to active plan"
  ],
  "testCommand": "pnpm prisma migrate dev",
  "passes": false
}
```

### PAY-003: Payment Webhook Handler
```json
{
  "id": "PAY-003",
  "title": "Handle Stripe webhook events",
  "type": "feature",
  "acceptanceCriteria": [
    "POST /stripe/webhook endpoint",
    "Validates Stripe signature",
    "Handles checkout.session.completed",
    "Updates Account subscription status"
  ],
  "testCommand": "Stripe CLI webhook test",
  "passes": false
}
```
