# Phase 2: Hardening - Implementation Plan

## Goal Description
Enhance the reliability and security of the Chat Event System by implementing robust input validation and expanding the test suite.

## User Review Required
> [!IMPORTANT]
> We will be adding `zod` for runtime validation. This ensures invalid data (e.g., bad RRule strings) is caught early with clear error messages.

## Proposed Changes

### Validation Layer
#### [NEW] [zod](https://zod.dev)
- Install `zod` and `nestjs-zod`.
- Create DTOs (Data Transfer Objects) for all commands.

#### [MODIFY] [TelegramService](file:///Users/402292/.gemini/antigravity/playground/emerald-aurora/booking-system/src/telegram/telegram.service.ts)
- Validate `/create` arguments (Title length, RRule format).
- Validate `/start` arguments (API Key format).

### Testing & Quality
#### [MODIFY] [Unit Tests]
- Update tests to cover invalid input scenarios.

#### [NEW] [Integration Tests]
- Create `test/app.e2e-spec.ts` extensions to test the full bot flow (mocking Telegram updates).

## Verification Plan

### Automated Tests
- Run `pnpm test` for unit tests.
- Run `pnpm test:e2e` for integration tests.

### Manual Verification
- Try creating an event with an invalid RRule (e.g., `/create Event @ NOT_A_VALID_RRULE`).
- Expect a helpful error message instead of a crash or silent failure.
