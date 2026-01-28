# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Context

**Event Booking System for Telegram** - A multi-tenant NestJS application that enables Telegram group administrators to create recurring events with automatic announcements, participant voting, and capacity management.

- **Stack**: NestJS 11 + PostgreSQL + Telegraf + Prisma
- **Type**: Telegram bot service (multi-tenant SaaS)
- **Current Phase**: Phase 2.8 (Documentation complete) → Phase 3 (Stripe monetization planned)
- **Quick Start**: `cp .env.example .env && docker-compose up -d --build`

---

## Essential Commands

### Development
```bash
pnpm start:dev              # Start dev server with hot reload (ENV=dev enables debug logs)
pnpm build                  # Compile TypeScript to dist/
pnpm start:prod             # Run compiled app (use after build)
```

### Database
```bash
pnpm prisma generate        # Regenerate Prisma client (after schema changes)
pnpm prisma migrate dev     # Create and apply migration interactively
pnpm prisma migrate deploy  # Apply migrations (production)
pnpm prisma studio         # Open visual database explorer on localhost:5555
```

### Testing
```bash
pnpm test                   # Run all unit tests once
pnpm test:watch            # Watch mode (re-run on file changes)
pnpm test:cov              # Generate coverage report
pnpm test scheduler.service.spec.ts        # Run specific test file
pnpm test -- --testNamePattern="pattern"   # Run tests matching pattern
pnpm test:e2e              # Run E2E tests
pnpm test:debug            # Run with Node debugger
```

### Code Quality
```bash
pnpm lint                   # Run ESLint with auto-fix
pnpm format                 # Run Prettier formatting
npx tsc --noEmit           # TypeScript type check (strict mode)
```

### Utilities
```bash
pnpm create-account "Org Name"  # Create test organization with API key
```

---

## Architecture & Data Flow

### Module Organization

**Core Modules** (business logic):
- **TelegramModule**: Bot commands (`/start`, `/create`, `/list`, `/announce`, `/id`, `/help`) and inline voting buttons
- **EventModule**: Event series CRUD, instance materialization, message formatting
- **SchedulerModule**: Daily cron (midnight) that materializes EventInstances 48h ahead and auto-announces
- **ParticipationModule**: Append-only vote logging (JOIN, LEAVE, PLUS_ONE actions)
- **AccountModule**: Multi-tenant management (API keys, user-to-account bindings)
- **TelegramUserModule**: User profile upsert from Telegram data

**Infrastructure**:
- **PrismaModule**: Global database service (singleton, injected everywhere)

### Key Data Models

```
Account (tenant)
├── ApiKey (authentication via /start)
├── AccountUserBinding (user roles: OWNER/ADMIN/MEMBER)
└── EventSeries (recurring event template)
    └── EventInstance (materialized occurrence, created daily)
        └── ParticipationLog (append-only vote history)

TelegramUser (independent of Account)
├── AccountUserBinding (many-to-many via binding)
└── ParticipationLog (votes across all instances)
```

**Critical design choices**:
- **Append-only ParticipationLog**: Enables vote history, "change mind" scenarios, analytics. Latest vote per user wins.
- **JSON recurrence field**: Stores iCal RRule as string or parsed object, flexible for future patterns
- **Composite unique (seriesId, startTime)**: Prevents duplicate instances during materialization
- **BigInt for Telegram IDs**: Telegram IDs exceed JavaScript number limits

### Data Flow for Event Creation

1. User runs `/create title="Event" rrule="FREQ=WEEKLY" group="-100123"`
2. **TelegramService.onCreate** parses named args, validates via Zod schema
3. **EventService.createSeries** creates EventSeries record
4. **SchedulerService.processSeries** immediately materializes instances (48h window)
5. **SchedulerService.autoAnnounce** posts to group if `chatId` set
6. Daily cron (midnight) runs **SchedulerService.materializeInstances** for all active series

### Data Flow for Voting

1. User clicks JOIN/LEAVE/+1 button in announcement
2. **TelegramService.onJoin/onLeave/onPlusOne** triggers recordVote
3. **ParticipationService.recordParticipation** creates append-only log entry
4. **TelegramService.recordVote** checks capacity, updates announcement message live
5. Message edit pulls latest attendance via **EventService.formatAttendanceMessage**

---

## Development Patterns

### Service Dependencies & Circular Imports

**SchedulerService ↔ EventService**: Resolved with `forwardRef()` in both module imports (see `scheduler.module.ts` and `event.module.ts`).

```typescript
@Inject(forwardRef(() => SchedulerService))
private readonly schedulerService: SchedulerService;
```

### Error Handling

- **NestJS exceptions**: Use built-in (`NotFoundException`, `BadRequestException`, `UnauthorizedException`)
- **Zod validation**: Schema validation in DTOs with `safeParse()`, custom error messages
- **Debug logging**: Enable with `ENV=dev pnpm start:dev`, shows parsed args and materialization details

### Type Safety

- **No `any` types**: Project uses 100% TypeScript strict mode
- **Prisma generated types**: Import from `@prisma/client` (EventSeries, EventInstance, etc.)
- **BigInt handling**: Telegram IDs stored as `BigInt`, convert with `BigInt(string)` and `toString()`

### Testing

- **Jest root in src/**: testRegex matches `*.spec.ts`, coverage in `../coverage`
- **Mocking Prisma**: Use `jest.spyOn(prisma.model, 'method').mockResolvedValue(...)`
- **Coverage goals**: 80%+ for services, 90%+ for utilities, 70%+ for controllers
- **Test patterns**: See `docs/TESTING.md` for comprehensive examples

---

## File Organization

```
src/
├── main.ts                  # NestJS bootstrap
├── app.module.ts            # Root module importing all features
├── app.service.ts           # Health check
├── prisma/                  # Global database service (injected everywhere)
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── telegram/                # Bot commands and webhook
│   ├── telegram.service.ts  # @Command handlers, @Action callbacks
│   ├── telegram.controller.ts # POST /webhook/:token
│   ├── telegram.module.ts
│   └── telegram.dto.ts      # Zod schemas for validation
├── event/                   # Event series and instance logic
│   ├── event.service.ts     # CRUD, materialization, formatting
│   └── event.module.ts
├── scheduler/               # Daily cron jobs
│   ├── scheduler.service.ts # @Cron jobs, RRule parsing
│   └── scheduler.module.ts
├── participation/           # Vote logging
│   ├── participation.service.ts
│   └── participation.module.ts
├── account/                 # Multi-tenancy
│   ├── account.service.ts   # API key validation, user bindings
│   └── account.module.ts
└── telegram-user/           # User profile management
    ├── telegram-user.service.ts
    └── telegram-user.module.ts
```

---

## Environment Variables

**Required**:
- `DATABASE_URL`: PostgreSQL connection (format: `postgresql://user:pass@host:5432/db?schema=public`)
- `TELEGRAM_BOT_TOKEN`: From @BotFather (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
- `TELEGRAM_BOT_NAME`: Bot username without @ prefix (e.g., `my_event_bot`, not `@my_event_bot`)

**Optional**:
- `ENV=dev`: Enable debug logging (shows parsed commands, cron details, RRule parsing)
- `PORT=3000`: Server port (default 3000)

**Docker Compose defaults** (in docker-compose.yml):
- `POSTGRES_USER=admin`, `POSTGRES_PASSWORD=secret`, `POSTGRES_DB=emerald`

---

## Key Implementation Details

### RRule Materialization

**File**: `src/scheduler/scheduler.service.ts:processSeries`

Uses `rrule` library. Series stores recurrence as:
- String: `"FREQ=WEEKLY;BYDAY=TU"` or `"DTSTART:20260120T100000Z\nFREQ=WEEKLY"`
- Fallback: Parsed object from database

**Critical**: If recurrence is string without DTSTART, pass `{ dtstart: series.createdAt }` to `rrulestr()`.

Window calculation: Materializes from `start` to `horizon` (48h default, 7 days for manual triggers).

### Capacity Checking

**File**: `src/telegram/telegram.service.ts:recordVote`

Logic:
1. Query all ParticipationLog for instance
2. Build latest votes map (per user, latest action wins)
3. Exclude current user from capacity count
4. If `JOIN` (+1) or `PLUS_ONE` (+2) would exceed limit → block with alert
5. Otherwise → create new log entry, update message

### Message Live Updates

**File**: `src/telegram/telegram.service.ts:recordVote` (end of function)

Only updates if both `announcementMessageId` and `announcementChatId` exist (set during `/announce`).

Uses `ctx.telegram.editMessageText()` with same keyboard buttons. If edit fails (e.g., message deleted), logs error but doesn't fail vote.

### Account Binding

**File**: `src/account/account.service.ts:bindUserToAccount`

- Called from `TelegramService.onStart` when user provides API key
- Creates or updates `AccountUserBinding` with `role: 'OWNER'`
- Always upserts (idempotent) - same user re-binding updates, doesn't duplicate

---

## Testing Considerations

### What to test first when adding features:
1. **Service layer** (unit tests): Business logic, edge cases, error conditions
2. **Validation** (unit tests): Zod schemas catch malformed input before service
3. **Integration** (if modifying API): POST /webhook/:token with mock Telegram update

### Common test patterns:
- Mock `PrismaService` methods with `jest.spyOn(...).mockResolvedValue(...)`
- Mock Telegraf `ctx` for command handlers
- Test both happy path and error cases

### No integration/E2E needed for:
- Command parsing (covered by unit tests with mocked ctx)
- Telegram API calls (covered by mocking ctx.telegram)
- Database operations (covered by mocking Prisma)

---

## Documentation References

- **AGENTS.md**: High-level overview, command reference, core concepts
- **docs/SETUP_GUIDE.md**: Local development and Docker setup
- **docs/DATABASE.md**: Full schema documentation with design decisions
- **docs/ERROR_HANDLING.md**: Error codes and debugging
- **docs/TESTING.md**: Test patterns and coverage strategy
- **docs/TROUBLESHOOTING.md**: Common issues and solutions
- **docs/OPS_GUIDE.md**: Production deployment and operations
- **CONTRIBUTING.md**: Development workflow and standards
- **docs/technical-specs.md**: API details and architecture diagrams
- **docs/prd.md**: Feature list organized by phase with acceptance criteria

---

## Production Infrastructure

The bot runs on a VM hosted on a Raspberry Pi 5:

```bash
# Access via Tailscale
ssh rp5                    # Connect to Raspberry Pi 5

# Access via LAN
ssh rp5.local              # Connect to Raspberry Pi 5 (local network)

# Then SSH to the telegram-bot VM
ssh telegram-bot           # From rp5, connect to the VM running the bot

# App location on VM
cd ~/apps/telegram-event-reservation-bot

# Common production commands
docker compose logs -f app           # View app logs
docker compose exec app npm run create-account  # Create new account
docker compose restart app           # Restart the bot
```

**Helper script**: `./create-account.sh` automates SSH chain to create accounts.

---

## Common Gotchas

1. **Timezone defaults to Europe/Helsinki**: In `EventSeries`, timezone defaults to `'Europe/Helsinki'` even if not specified in `/create`
2. **Group IDs must be negative**: Format is always negative BigInt (e.g., `-100123456789`)
3. **ParticipationLog is append-only**: No updates, only inserts. Latest action per user is computed on-read
4. **RRule without DTSTART**: Must pass `dtstart` explicitly to `rrulestr()` or it uses epoch
5. **Telegram BigInt IDs**: Must use `BigInt()` constructor, not `parseInt()`, to avoid overflow
6. **Prisma schema changes**: Always run `pnpm prisma migrate dev` to generate client, not just `prisma generate`
7. **Circular module imports**: EventModule ↔ SchedulerModule use `forwardRef()` - do not remove or app won't boot
8. **Docker DATABASE_URL**: Use `postgres` (service name) not `localhost` when running in Docker

