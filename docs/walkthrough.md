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

### 5. Manual Webhook Testing (via Curl)
You can simulate Telegram messages locally without a public URL using `curl`.

#### Test Account Binding
```bash
# Replace <YOUR_BOT_TOKEN> with the actual token in your .env
curl -X POST http://localhost:3000/webhook/<YOUR_BOT_TOKEN> \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1000,
    "message": {
      "message_id": 1,
      "from": { "id": 12345678, "first_name": "Tester", "username": "tester" },
      "chat": { "id": 12345678, "type": "private" },
      "date": 1618822500,
      "text": "/start sk_YOUR_KEY_HERE"
    }
  }'
```

#### Test Listing Series
```bash
curl -X POST http://localhost:3000/webhook/<YOUR_BOT_TOKEN> \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1001,
    "message": {
      "message_id": 2,
      "from": { "id": 12345678, "first_name": "Tester" },
      "chat": { "id": 12345678, "type": "private" },
      "text": "/list"
    }
  }'
```

#### Test Creating Event Series
```bash
# Valid creation
curl -X POST http://localhost:3000/webhook/<YOUR_BOT_TOKEN> \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1002,
    "message": {
      "message_id": 3,
      "from": { "id": 12345678 },
      "chat": { "id": 12345678, "type": "private" },
      "text": "/create Yoga @ FREQ=WEEKLY;BYDAY=MO"
    }
  }'

# Invalid: Missing @
curl -X POST http://localhost:3000/webhook/<YOUR_BOT_TOKEN> \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1003,
    "message": {
      "message_id": 4,
      "from": { "id": 12345678 },
      "chat": { "id": 12345678, "type": "private" },
      "text": "/create Bad Input"
    }
  }'

# Invalid: Malformed RRULE (validation check)
curl -X POST http://localhost:3000/webhook/<YOUR_BOT_TOKEN> \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1004,
    "message": {
      "message_id": 5,
      "from": { "id": 12345678 },
      "chat": { "id": 12345678, "type": "private" },
      "text": "/create Yoga @ NOT_A_RRULE"
    }
  }'
```

#### Test Announcement
```bash
curl -X POST http://localhost:3000/webhook/<YOUR_BOT_TOKEN> \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1005,
    "message": {
      "message_id": 6,
      "from": { "id": 12345678 },
      "chat": { "id": 12345678, "type": "private" },
      "text": "/announce"
    }
  }'
```

#### Test Interactive Buttons (Action Callbacks)
```bash
# Simulating a user clicking ✅ JOIN on instance_id
curl -X POST http://localhost:3000/webhook/<YOUR_BOT_TOKEN> \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1006,
    "callback_query": {
      "id": "cb_1",
      "from": { "id": 12345678, "username": "tester" },
      "data": "JOIN:actual_instance_id_here"
    }
  }'
```

## Next Steps: Phase 2 (Hardening)
- Integration tests with a real database in CI.
- Better error handling and input validation (Zod/Class-validator).
- Enhanced bot feedback (updating message text with participant names).
