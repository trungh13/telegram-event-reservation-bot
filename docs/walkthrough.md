# Phase 1 Walkthrough: Core Implementation

I have completed the core primitives and Telegram bot integration for the Chat Event System.

## Key Features Implemented

### 1. Account & Security
- **Multi-tenancy**: Accounts are separate entities.
- **API Keys**: Each account has unique API keys (`sk_...`).
- **User Binding**: Telegram users bind to accounts via `/start <api_key>` deep-links.

### 2. Event Series & Recurrence
- **RRule Integration**: Events use industry-standard recurrence strings (e.g., `FREQ=WEEKLY`).
- **Rolling Materialization**: A cron worker scans active series and creates concrete `EventInstance` records for the next 30 days.
- **Timezone**: Defaulted to `Europe/Helsinki`.

### 3. Participation & Voting
- **Append-only Logging**: All interactions (JOIN, LEAVE, +1) are recorded as logs.
- **Derived State**: Participations are retrieved from logs for a specific event instance.

### 4. Telegram Bot Interaction
- `/start <token>`: Bind yourself to an account (or use deep link).
- `/create <title> @ <rrule>`: Create a new event series.
- `/list`: List active event series.
- `/announce`: Post an event with interactive voting buttons.
- **Action Buttons**: ✅ JOIN, ➕ +1, ❌ LEAVE.

## Verification

### Automated Tests
I have implemented unit tests for all core services:
- `AccountService`: Creation and validation.
- `EventService`: Series creation and active retrieval.
- `ParticipationService`: Logging and user upserts.
- `SchedulerService`: Materialization and idempotency.

All tests are passing:
```bash
pnpm test
```

### Manual Verification Steps
1. **Database**: `docker-compose up -d`
2. **Setup**: Add your `TELEGRAM_BOT_TOKEN` to `.env`.
3. **Run**: `pnpm run start:dev`
4. **Interact**: 
   - Get your API key by running `pnpm create-account "My Team"`.
   - Use the provided deep link (e.g., `t.me/event_reservation_bot?start=sk_...`) or manually send `/start <key>`.
   - Use `/create Yoga @ FREQ=DAILY`
   - Use `/announce` and vote!

## Next Steps: Phase 2 (Hardening)
- Integration tests with a real database in CI.
- Better error handling and input validation (Zod/Class-validator).
- Enhanced bot feedback (updating message text with participant names).
