# Phase 2: Hardening - Implementation Plan

## Goal Description
Enhance the reliability and security of the Chat Event System by implementing robust input validation and expanding the test suite.

## User Review Required
> [!IMPORTANT]
@> We are switching to a **quoted argument format** for commands to handle spaces naturally.
> Syntax: `/create "Title" "RRule" ["Date"]`
> Both `/start` (without args) and `/help` will now show the same comprehensive guide.

## Proposed Changes

### Group & Topic Context
#### [MODIFY] [Prisma Schema](file:///Users/402292/.gemini/antigravity/playground/emerald-aurora/booking-system/prisma/schema.prisma)
- Add `chatId` (BigInt) and `topicId` (String?) to `EventSeries`.

#### [MODIFY] [TelegramService](file:///Users/402292/.gemini/antigravity/playground/emerald-aurora/booking-system/src/telegram/telegram.service.ts)
- **Capture Context**: during `/create`, extract `ctx.chat.id` and `ctx.message.message_thread_id`.
- **Pass Context**: Save these to the Series.

#### [MODIFY] [Scheduler/Event Service]
- **RRule Logic**: Ensure the parsed `StartDate` is passed as `dtstart` options to RRule.
- **Verification**: Ensure `rrule.between()` respects the "next match" logic given the start date.

### Validation & UX Layer
#### [MODIFY] [TelegramService](file:///Users/402292/.gemini/antigravity/playground/emerald-aurora/booking-system/src/telegram/telegram.service.ts)
- **Quoted Parsing**: A utility to extract arguments within double quotes.
- **Support for Start Date**: Optional 3rd argument in `dd/mm/yyyy HH:mm` format.
- **Consolidated Messaging**: A shared helper to render the welcome/help guide.
- **Cheat Sheet**: Include RRule examples in the guide.
- **Zod Validation**: Updated to handle the new field structure.

### RRule Cheat Sheet
| Parameter | Description | Examples |
| :--- | :--- | :--- |
| **FREQ** | Frequency | `DAILY`, `WEEKLY`, `MONTHLY` |
| **BYDAY** | Specific days | `MO,TU,WE,TH,FR,SA,SU` |
| **INTERVAL** | Every X intervals | `INTERVAL=2` (Every 2nd week) |
| **UNTIL** | End date | `20251231T235959Z` |

### Testing & Quality
#### [MODIFY] [Unit Tests]
- Verify quoting logic.
- Verify date parsing.
- Verify consolidated help output.

## Verification Plan

### Manual Verification
- Run: `/create "Team Sync" "FREQ=WEEKLY;BYDAY=TU" "01/02/2026 09:00"`
- Run: `/help` to see the new guide.
